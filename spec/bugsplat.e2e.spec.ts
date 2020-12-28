import { BugSplat } from '../src/bugsplat';
import * as fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
const FormData = require('form-data');
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
        const additionalFile = "./spec/files/additionalFile.txt";
        const fileName = path.basename(additionalFile);
        const fileContents = fs.createReadStream(additionalFile);
        const additionalFormDataParams = <any>[{ key: fileName, value: fileContents }];
        const bugsplat = new BugSplat(database, appName, appVersion);
        bugsplat.setDefaultAppKey(appKey);
        bugsplat.setDefaultUser(user);
        bugsplat.setDefaultEmail(email);
        bugsplat.setDefaultDescription(description);
        const result = await bugsplat.post(error, { additionalFormDataParams });
    
        if (result.error) {
            throw new Error(result.error.message);
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
        const errorToPost = <any>"error!";
        const bugsplat = new BugSplat(database, appName, appVersion);

        const result = await bugsplat.post(errorToPost, {});
        if (result.error) {
            throw new Error(result.error.message);
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

    async function getCrashData(database, crashId) {
        const cookie = await postLogin(username, password)
        const getOptions = getCrashDataRequestOptions(database, crashId, cookie);
        const response = await fetch (getOptions.url, getOptions.data);
        const json = await response.json();

        if (response.status !== 200) {
             throw new Error('Could not GET crash data!');
        }

        return json;
    }

    function getCrashDataRequestOptions(database, crashId, cookie) {
        return {
            url: appBaseUrl + `/api/crash/data?database=${database}&id=${crashId}`,
            data: {
                method: 'GET',
                cache: 'no-cache',
                redirect: 'follow',
                headers: {
                    cookie: cookie
                }
            }
        };
    }

    async function postLogin(username, password) {
        const postOptions = getLoginPostRequestOptions(username, password);
        const response = await fetch(postOptions.url, postOptions.data);
        const json = await response.json();
        const cookie = parseCookies(response);

        return cookie;
    }

    function getLoginPostRequestOptions(username, password) {
        const formData = new FormData();
        formData.append('email', username);
        formData.append('password', password);
        formData.append('Login', 'Login');
        return {
            url: appBaseUrl + '/api/authenticatev3.php',
            data: {
                method: 'POST',
                credentials: 'include',
                cache: 'no-cache',
                body: formData,
                redirect: 'follow'
            }
        };
    }

    function parseCookies(response) {
        const raw = response.headers.raw()['set-cookie'];
        return raw.map((entry) => {
          const parts = entry.split(';');
          const cookiePart = parts[0];
          return cookiePart;
        }).join(';');
      }
});