const request = require("request");
const path = require("path");
const fs = require("fs");

module.exports = function(database, appName, appVersion) {
    
    if(!database || database === "") {
        throw new Error("BugSplat error: no database was specified!");
    }

    if(!appName || appName === "") {
        throw new Error("BugSplat error: no appName was specified!");
    }

    if(!appVersion || appVersion === "") {
        throw new Error("BugSplat error: no appVersion was specified!");
    }

    const _additionalFilePaths = [];
    let _user = "";
    let _email = "";
    let _description = "";
    let _appKey = "";
    
    this.setAppKey = function(appKey) {
        _appKey = appKey;
    };

    this.setUser = function(user) {
        _user = user;
    };

    this.setEmail = function(email) {
        _email = email;
    };

    this.setDescription = function(description) {
        _description = description;
    };

    this.addAdditionalFile = function(filePath) {
        _additionalFilePaths.push(filePath);
    };

    this.post = function(errorToPost, callback) {
        
        const url = "https://" + database + ".bugsplat.com/post/js/";       
        const callstack = errorToPost.stack == null ? errorToPost : errorToPost.stack;
        const req = request.post({
            url: url
        }, function(requestErr, httpResponse, responseBody) {
            if(requestErr) {
                callback(requestErr, null, errorToPost);
                return;
            }
            console.log("BugSplat POST status code:", httpResponse.statusCode);
            console.log("BugSplat POST response body:", responseBody);
            setDescription("");
            if(callback) {
                if(httpResponse.statusCode == 200 && responseBody) {
                    callback(null, JSON.parse(responseBody), errorToPost);
                } else if(httpResponse.statusCode == 400) {
                    callback(new Error("BugSplat Error: " + responseBody), null, errorToPost);
                } else if(httpResponse.statusCode == 429) {
                    callback(new Error("BugSplat Error: Rate limit of one crash per second exceeded"), null, errorToPost);
                } else {
                    callback(new Error("BugSplat Error: Unknown error"), null, errorToPost);
                }
            }
        });

        const form = req.form();
        form.append("database", database);
        form.append("appName", appName);
        form.append("appVersion", appVersion);
        form.append("appKey", _appKey);
        form.append("user", _user);
        form.append("email", _email);
        form.append("description", _description);
        form.append("callstack", callstack);

        addAdditionalFilesToForm(form, _additionalFilePaths);
 
        console.log("BugSplat Error:", errorToPost);
        console.log("BugSplat Url:", url);
    }

    this.postAndExit = function(err) {
        this.post(err, (response) => process.exit(1));
    }

    return this;
};

function addAdditionalFilesToForm(form, additionalFilePaths) {
    let totalZipSize = 0;
    for(var i = 0; i < additionalFilePaths.length; i++) {
        const filePath = additionalFilePaths[i];
        if(fs.existsSync(filePath)) {
            const fileSize = fs.statSync(filePath).size;
            totalZipSize = totalZipSize + fileSize;
            if(totalZipSize <= 1048576) {
                const fileName = path.basename(filePath);
                const fileContents = fs.createReadStream(filePath);
                form.append(fileName, fileContents);
            } else {
                console.error("BugSplat upload limit of 1MB exceeded, skipping file:", filePath);
                totalZipSize = totalZipSize - fileSize;
            }
        } else {
            console.error("BugSplat file doesn't exist at path:", filePath);
        }
    }
}