const BugSplat = require("../bugsplat");
const request = require("request");
const fs = require("fs");
const path = require("path");
const username = "Fred";
const password = "Flintstone";
const appBaseUrl = "https://app.bugsplat.com";

describe("BugSplat", function () {

    it("should post a crash report with all provided information", async () => {
        const database = "fred";
        const appName = "my-node-crasher";
        const appVersion = "1.2.3.4";
        const error = new Error("BugSplat!!");
        const appKey = "Key!";
        const user = "User!";
        const email = "fred@bedrock.com";
        const description = "Description!";
        const additionalFile = "./e2e/files/additionalFile.txt";
        const fileName = path.basename(additionalFile);
        const fileContents = fs.createReadStream(additionalFile);
        const additionalFormDataParams = [{ key: fileName, value: fileContents }];
        const bugsplat = new BugSplat(database, appName, appVersion);
        bugsplat.setDefaultAppKey(appKey);
        bugsplat.setDefaultUser(user);
        bugsplat.setDefaultEmail(email);
        bugsplat.setDefaultDescription(description);
        const result = await bugsplat.post(error, { additionalFormDataParams });
        
        if (result.error) {
            throw new Error(result.error);
        }

        const expectedCrashId = result.response.crash_id;
        const crashData = await getCrashData(database, expectedCrashId);

        expect(crashData["appName"]).toEqual(appName);
        expect(crashData["appVersion"]).toEqual(appVersion);
        expect(crashData["appKey"]).toEqual(appKey);
        expect(crashData["description"]).toEqual(description);
        expect(crashData["user"]).toBeTruthy() // Fred has PII obfuscated so the best we can do here is to check if truthy
        expect(crashData["email"]).toBeTruthy()  // Fred has PII obfuscated so the best we can do here is to check if truthy
    }, 30000);

    it("should post a crash if errorToPost is not an Error object", async () => {
        const database = "fred";
        const appName = "my-node-crasher";
        const appVersion = "4.3.2.1";
        const errorToPost = "error!";
        const bugsplat = new BugSplat(database, appName, appVersion);

        const result = await bugsplat.post(errorToPost, {});
        if (result.error) {
            throw new Error(result.error);
        }

        const expectedCrashId = result.response.crash_id;
        const crashData = await getCrashData(database, expectedCrashId);
        expect(crashData["appName"]).toEqual(appName);
        expect(crashData["appVersion"]).toEqual(appVersion);
    }, 10000);

    xit("should return error if crash rate limit exceeded", (done) => {
        const database = "fred";
        const appName = "my-node-crasher";
        const appVersion = "1.0.0.0";
        const error = new Error("BugSplat!");
        const bugsplat = new BugSplat(database, appName, appVersion);
        const numberOfRequestsToSend = 10;

        for (let i = 0; i < numberOfRequestsToSend; i++) {
            bugsplat.post(error, {}).then(result => {
                if (result.error) {
                    expect(result.error.message).toContain("Rate limit of one crash per second exceeded");
                    done();
                }
            });
        }
    }, 30000);

    function getCrashData(database, crashId) {
        return new Promise(function (resolve, reject) {
            const cookieJar = request.jar();
            postLogin(username, password, cookieJar)
                .then(function () {
                    const getOptions = getCrashDataRequestOptions(database, crashId, cookieJar);
                    request(getOptions, function (error, response, body) {
                        if (error) throw new Error(error);
                        console.log("GET individualCrash status code:", response.statusCode);
                        console.log("GET individualCrash body:", body);
                        resolve(JSON.parse(body));
                    });
                });
        });
    }

    function getCrashDataRequestOptions(database, crashId, cookieJar) {
        return {
            method: "GET",
            url: appBaseUrl + "/api/crash/data",
            qs: {
                "database": database,
                "id": crashId,
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
            url: appBaseUrl + '/api/authenticatev3.php',
            headers:
                {
                    'cache-control': 'no-cache',
                    'content-type': 'application/x-www-form-urlencoded'
                },
            form:
                {
                    email: username,
                    password: password,
                    Login: 'Login'
                },
            followAllRedirects: true,
            jar: cookieJar
        };
    }
});