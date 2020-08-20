const fetch = globalThis.fetch ? globalThis.fetch : require("node-fetch");
const formData = globalThis.FormData ? globalThis.FormData : require("form-data");


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

    this._additionalFormDataParams = [];
    this._appKey = '';
    this._description = '';
    this._email = '';
    this._user = '';
    this._formData = formData;
    this._fetch = fetch;

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
        const additionalFormDataParams = options.additionalFormDataParams || [];

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
        additionalFormDataParams.forEach(param => body.append(param.key, param.value));
        // TODO move to bugsplat-node
        //this._addAdditionalFilesToBody(body, additionalFilePaths);

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