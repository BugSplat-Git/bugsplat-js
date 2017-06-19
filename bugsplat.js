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
    let _callback;

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

    this.setCallback = function(callback) {
        _callback = callback;
    };

    this.addAdditionalFile = function(filePath) {
        _additionalFilePaths.push(filePath);
    };

    this.post = function(err) {
        
        const url = "https://" + database + ".bugsplat.com/post/js/";       
        const callstack = err.stack == null ? err : err.stack;
        const req = request.post({
            url: url
        }, function(err, httpResponse, body) {
            if(err) {
                console.error("BugSplat POST error:", err);
                return;
            }
            console.log("BugSplat POST status code:", httpResponse.statusCode);
            console.log("BugSplat POST response body:", body);
            setDescription("");
            if(_callback) {
                if(httpResponse.statusCode == 200 && body) {
                    _callback(null, JSON.parse(body));
                } else if(httpResponse.statusCode == 400) {
                    _callback(new Error("BugSplat Error: " + body), null);
                } else if(httpResponse.statusCode == 429) {
                    _callback(new Error("BugSplat Error: Rate limit of one crash per second exceeded"), null);
                } else {
                    _callback(new Error("BugSplat Error: Unknown error"), null);
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
 
        console.log("BugSplat Error:", err);
        console.log("BugSplat Url:", url);
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