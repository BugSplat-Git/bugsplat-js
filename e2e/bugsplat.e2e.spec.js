const request = require("request");
const username = "Fred";
const password = "Flintstone";
const appBaseUrl = "https://app.bugsplat.com";

describe("BugSplat", function () {

    it("should post a crash report with all provided information", (done) => {
        const database = "fred";
        const appName = "myJavaScriptCrasher";
        const appVersion = "1.2.3.4";
        const error = new Error("dummy");
        const appKey = "Key!";
        const user = "User!";
        const email = "fred@bedrock.com";
        const description = "Description!";
        const additionalFile = "./e2e/files/additionalFile.txt";
        const bugsplat = require("../bugsplat")(database, appName, appVersion);
        bugsplat.setAppKey(appKey);
        bugsplat.setUser(user);
        bugsplat.setEmail(email);
        bugsplat.setDescription(description);
        bugsplat.addAdditionalFile(additionalFile);
        bugsplat.post(error, function (requestError, responseBody, originalError) {
            if (requestError) {
                done(requestError);
            }
            const expectedCrashId = responseBody.crash_id;
            getIndividualCrashData(database, expectedCrashId)
                .then(function (crashData) {
                    expect(crashData["appName"]).toEqual(appName);
                    expect(crashData["appVersion"]).toEqual(appVersion);
                    expect(crashData["appDescription"]).toEqual(appKey);
                    expect(crashData["additionalInfo"]).toEqual(description);
                    expect(crashData["user"]).toBeTruthy() // Fred has PII obfuscated so the best we can do here is to check if truthy
                    expect(crashData["email"]).toBeTruthy()  // Fred has PII obfuscated so the best we can do here is to check if truthy
                    done();
                });
        });
    }, 30000);

    it("should post a crash if errorToPost is not an Error object", (done) => {
        const database = "fred";
        const appName = "myJavaScriptCrasher";
        const appVersion = "4.3.2.1";
        const errorToPost = "error!";
        const bugsplat = require("../bugsplat")(database, appName, appVersion);
        const numberOfRequestsToSend = 3;
        bugsplat.post(errorToPost, function (requestError, responseBody, originalError) {
            if (requestError) {
                done(requestError);
            }
            const expectedCrashId = responseBody.crash_id;
            getIndividualCrashData(database, expectedCrashId)
                .then(function (crashData) {
                    expect(crashData["appName"]).toEqual(appName);
                    expect(crashData["appVersion"]).toEqual(appVersion);
                    done();
                })
                .catch(err => done(err));
        });
    }, 10000);

    it("should return error if crash rate limit exceeded", (done) => {
        const database = "fred";
        const appName = "myJavaScriptCrasher";
        const appVersion = "1.0.0.0";
        const error = new Error("dummy");
        const bugsplat = require("../bugsplat")(database, appName, appVersion);
        const numberOfRequestsToSend = 3;

        for (let i = 0; i < numberOfRequestsToSend; i++) {
            bugsplat.post(error, function (responseError, responseBody, originalError) {
                if (responseError) {
                    expect(responseError.message).toContain("Rate limit of one crash per second exceeded");
                    expect(responseBody).toBeNull();
                    done();
                }
            });
        }
    }, 10000);

    it("should call the callback function", (done) => {
        const bugsplat = require("../bugsplat")("fred", "myJavaScriptCrasher", "1.0.0.0");
        bugsplat.post(new Error("dummy"), (responseError, responseBody, originalError) => done()); // If done is not called the test times out and fails
    }, 10000);

    function getIndividualCrashData(database, crashId) {
        return new Promise(function (resolve, reject) {
            const cookieJar = request.jar();
            postLogin(username, password, cookieJar)
                .then(function () {
                    const getOptions = getIndividualCrashDataRequestOptions(database, crashId, cookieJar);
                    request(getOptions, function (error, response, body) {
                        if (error) throw new Error(error);
                        console.log("GET individualCrash status code:", response.statusCode);
                        console.log("GET individualCrash body:", body);
                        resolve(JSON.parse(body));
                    });
                });
        });
    }

    function getIndividualCrashDataRequestOptions(database, crashId, cookieJar) {
        return {
            method: "GET",
            url: appBaseUrl + "/individualCrash/",
            qs: {
                "database": database,
                "id": crashId,
                "data": ""
            },
            headers:
                {
                    'cache-control': 'no-cache',
                    'content-type': 'application/x-www-form-urlencoded'
                },
            jar: cookieJar
        };
    }

    function postLogin(username, password, cookieJar) {
        return new Promise(function (resolve, reject) {
            const postOptions = getLoginPostRequestOptions(username, password, cookieJar);
            request(postOptions, function (error, response, body) {
                if (error) throw new Error(error);
                console.log("POST login status code:", response.statusCode);
                console.log("POST login body:", body);
                response.headers['set-cookie'].forEach(function (cookie) {
                    if (cookie.includes("PHPSESSID")) {
                        cookieJar.setCookie(cookie, appBaseUrl);
                        resolve();
                    }
                });
            });
        });
    }

    function getLoginPostRequestOptions(username, password, cookieJar) {
        return {
            method: 'POST',
            url: appBaseUrl + '/api/authenticate.php',
            headers:
                {
                    'cache-control': 'no-cache',
                    'content-type': 'application/x-www-form-urlencoded'
                },
            form:
                {
                    Sender: 'sales%40bugsplatsoftware.com',
                    email: username,
                    password: password,
                    Login: 'Login'
                },
            followAllRedirects: true,
            jar: cookieJar
        };
    }
});