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

    this._database = database;
    this._appName = appName;
    this._appVersion = appVersion;

    this._additionalFilePaths = [];
    this._appKey = '';
    this._description = '';
    this._email = '';
    this._user = '';
    this._formData = formData;
    this._fetch = fetch;

    this.setDefaultAdditionalFilePaths = (additionalFilePaths) => {
        this._additionalFilePaths = additionalFilePaths;
    }

    this.setDefaultAppKey = (appKey) => {
        this._appKey = appKey;
    }

    this.setDefaultDescription = (description) => {
        this._description = description;
    }

    this.setDefaultEmail = (email) => {
        this._email = email;
    }

    this.setDefaultUser = (user) => {
        this._user = user;
    }

    this.post = async (errorToPost, options) => {
        options = options || {};

        const appKey = options.appKey || this._appKey;
        const user = options.user || this._user;
        const email = options.email || this._email;
        const description = options.description || this._description;
        const additionalFilePaths = options.additionalFilePaths || this._additionalFilePaths;

        const url = "https://" + database + ".bugsplat.com/post/js/";
        const callstack = !errorToPost.stack ? errorToPost : errorToPost.stack;
        const method = "POST";
        const body = this._formData();
        body.append("database", database);
        body.append("appName", appName);
        body.append("appVersion", appVersion);
        body.append("appKey", appKey);
        body.append("user", user);
        body.append("email", email);
        body.append("description", description);
        body.append("callstack", callstack);
        this._addAdditionalFilesToBody(body, additionalFilePaths);

        console.log("BugSplat Error:", errorToPost);
        console.log("BugSplat Url:", url);

        const response = await this._fetch(url, { method, body });
        const json = await this._tryParseResponseJson(response);

        console.log("BugSplat POST status code:", response.status);
        console.log("BugSplat POST response body:", json);

        if (response.status === 400) {
            return this._createReturnValue(new Error("BugSplat Error: Bad request"), json, errorToPost);
        }

        if (response.status === 429) {
            return this._createReturnValue(new Error("BugSplat Error: Rate limit of one crash per second exceeded"), json, errorToPost);
        }

        if (!response.ok) {
            return this._createReturnValue(new Error("BugSplat Error: Unknown error"), json, errorToPost);
        }

        return this._createReturnValue(null, json, errorToPost);
    }

    this.postAndExit = async (errorToPost, options) => {
        return this.post(errorToPost, options).then(() => process.exit(1));
    }

    this._addAdditionalFilesToBody = (body, additionalFilePaths) => {
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

    this._createReturnValue = (error, response, original) => {
        return {
            error,
            response,
            original
        };
    }

    this._tryParseResponseJson = async (response) => {
        let parsed;
        try {
            parsed = await response.json();
        } catch (_) {
            parsed = {};
        }
        return parsed;
    }
};