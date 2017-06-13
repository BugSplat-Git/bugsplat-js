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
        const callstack = errCallStackAdapter(err); 
        const form = {
            "database": database,
            "appName": appName,
            "appVersion": appVersion,
            "appKey": _appKey,
            "user": _user,
            "email": _email,
            "description": _description,
            "callstack": callstack
        };

        addAdditionalFilesToForm(form, _additionalFilePaths);
 
        console.log("BugSplat Error:", err);
        console.log("BugSplat Url:", url);
        console.log("BugSplat Form:", form);

        request.post({
            url: url,
            form: form
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
    }

    return this;
};

function addAdditionalFilesToForm(form, additionalFilePaths) {
    let totalZipSize = 0;
    for(var i = 0; i < additionalFilePaths.length; i++) {
        const filePath = additionalFilePaths[i];
        if(fs.existsSync(filePath)) {
            const fileName = path.basename(filePath);
            const fileSize = fs.statSync(filePath).size;
            totalZipSize = totalZipSize + fileSize;
            if(totalZipSize <= 1048576) { 
                const fileContents = new Buffer(fs.readFileSync(filePath)).toString("base64"); // TODO BG can we have request do this for us?
                const fileNameKey = "fileName" + (i + 1);
                const optFileKey = "optFile" + (i + 1);
                form[fileNameKey] = fileName;
                form[optFileKey] = fileContents;
            } else {
                console.error("BugSplat upload limit of 1MB exceeded, skipping file:", filePath);
                totalZipSize = totalZipSize - fileSize;
            }
        } else {
            console.error("BugSplat file doesn't exist at path:", filePath);
        }
    }
}

// TODO BG remove after fixing on backend
// TODO BG make sure backend can handle empty callstacks
function errCallStackAdapter(err) {
    if(!err.stack) return err;
    return err.stack.split("\n").join("\r\n"); // TODO BG fix on back-end
}