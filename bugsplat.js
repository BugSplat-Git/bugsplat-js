const fetch = require("node-fetch");
const formData = require("form-data");
const fs = require("fs");
const path = require("path");

module.exports = function (database, appName, appVersion) {

    if (!database || database === "") {
        throw new Error("BugSplat error: no database was specified!");
    }

    if (!appName || appName === "") {
        throw new Error("BugSplat error: no appName was specified!");
    }

    if (!appVersion || appVersion === "") {
        throw new Error("BugSplat error: no appVersion was specified!");
    }

    let _defaultUser = "";
    let _defaultEmail = "";
    let _defaultDescription = "";
    let _defaultAppKey = "";
    let _defaultAdditionalFilePaths = [];

    this._fetch = fetch;
    this._formData = formData;

    this.setDefaultAppKey = function (appKey) {
        _defaultAppKey = appKey;
    };

    this.setDefaultUser = function (user) {
        _defaultUser = user;
    };

    this.setDefaultEmail = function (email) {
        _defaultEmail = email;
    };

    this.setDefaultDescription = function (description) {
        _defaultDescription = description;
    };

    this.setDefaultAdditionalFilePaths = function (paths) {
        _defaultAdditionalFilePaths = paths;
    };

    this.post = async function (errorToPost, options) {
        options = options || {};

        const appKey = options.appKey || _defaultAppKey;
        const user = options.user || _defaultUser;
        const email = options.email || _defaultEmail;
        const description = options.description || _defaultDescription;
        const additionalFilePaths = options.additionalFilePaths || _defaultAdditionalFilePaths;

        const url = "https://" + database + ".bugsplat.com/post/js/";
        const callstack = !errorToPost.stack ? errorToPost : errorToPost.stack;
        const method = "POST";
        const body = _formData();
        body.append("database", database);
        body.append("appName", appName);
        body.append("appVersion", appVersion);
        body.append("appKey", appKey);
        body.append("user", user);
        body.append("email", email);
        body.append("description", description);
        body.append("callstack", callstack);
        addAdditionalFilesToBody(body, additionalFilePaths);

        console.log("BugSplat Error:", errorToPost);
        console.log("BugSplat Url:", url);

        const response = await _fetch(url, { method, body });
        const json = await tryParseResponseJson(response);

        console.log("BugSplat POST status code:", response.status);
        console.log("BugSplat POST response body:", json);

        if (response.status === 400) {
            return createReturnValue(new Error("BugSplat Error: Bad request"), json, errorToPost);
        }

        if (response.status === 429) {
            return createReturnValue(new Error("BugSplat Error: Rate limit of one crash per second exceeded"), json, errorToPost);
        }

        if (!response.ok) {
            return createReturnValue(new Error("BugSplat Error: Unknown error"), json, errorToPost);
        }

        return createReturnValue(null, json, errorToPost);
    }

    this.postAndExit = async function (errorToPost, options) {
        return this.post(errorToPost, options).then(() => process.exit(1));
    }

    return this;
};

function addAdditionalFilesToBody(body, additionalFilePaths) {
    let totalZipSize = 0;
    for (var i = 0; i < additionalFilePaths.length; i++) {
        const filePath = additionalFilePaths[i];
        if (fs.existsSync(filePath)) {
            const fileSize = fs.statSync(filePath).size;
            totalZipSize = totalZipSize + fileSize;
            if (totalZipSize <= 1048576) {
                const fileName = path.basename(filePath);
                const fileContents = fs.createReadStream(filePath);
                body.append(fileName, fileContents);
            } else {
                console.error("BugSplat upload limit of 1MB exceeded, skipping file:", filePath);
                totalZipSize = totalZipSize - fileSize;
            }
        } else {
            console.error("BugSplat file doesn't exist at path:", filePath);
        }
    }
}

async function tryParseResponseJson(response) {
    let parsed;
    try {
        parsed = await response.json();
    } catch(_) {
        parsed = {};
    }
    return parsed;
}

function createReturnValue(error, response, original) {
    return {
        error,
        response,
        original
    };
}