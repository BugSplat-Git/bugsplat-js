describe("BugSplat", function () {

    const database = "fred";
    const appName = "myJavaScriptCrasher";
    const appVersion = "1.0.0.0";
    const expectedStatus = "success";
    const expectedCrashId = 73180;
    const fakeSuccessReponseBody = "{ \"status\": \"" + expectedStatus + "\", \"crash_id\": " + expectedCrashId + " }";

    let bugsplat;

    beforeEach(() => bugsplat = require("../bugsplat")(database, appName, appVersion));

    it("should throw exception if user doesn't supply a database", () => {
        try {
            require("../bugsplat")();
        } catch (err) {
            expect(err.message).toContain("no database was specified!");
        }
    });

    it("should throw exception if user doesn't supply an appName", () => {
        try {
            require("../bugsplat")("fred");
        } catch (err) {
            expect(err.message).toContain("no appName was specified!");
        }
    });

    it("should throw exception if user doesn't supply an appVersion", () => {
        try {
            require("../bugsplat")("fred", "myJavaScriptCrasher");
        } catch (err) {
            expect(err.message).toContain("no appVersion was specified!");
        }
    });

    it("should use default appKey if options.appKey is not set", () => {
        createDefaultPropertyTest(bugsplat, "appKey", "defaultAppKey", bugsplat.setDefaultAppKey);
    });

    it("should use options.appKey if set", () => {
        const appKey = "overridenAppKey";
        createOptionsOverrideTest(bugsplat, { appKey: appKey }, "appKey", appKey);
    });

    it("should use default user if options.user is not set", () => {
        createDefaultPropertyTest(bugsplat, "user", "defaultUser", bugsplat.setDefaultUser);
    });

    it("should use options.user if set", () => {
        const user = "overridenUser";
        createOptionsOverrideTest(bugsplat, { user: user }, "user", user);
    });

    it("should use default email if options.email is not set", () => {
        createDefaultPropertyTest(bugsplat, "email", "defaultEmail", bugsplat.setDefaultEmail);
    });

    it("should use options.email if set", () => {
        const email = "overridenEmail";
        createOptionsOverrideTest(bugsplat, { email: email }, "email", email);
    });

    it("should use default description if options.description is not set", () => {
        createDefaultPropertyTest(bugsplat, "description", "defaultDescription", bugsplat.setDefaultDescription);
    });

    it("should use options.description if set", () => {
        const description = "overridenDescription";
        createOptionsOverrideTest(bugsplat, { description: description }, "description", description);
    });

    it("should append database to post form", () => {
        createDefaultPropertyTest(bugsplat, "database", database);
    });

    it("should append appName to post form", () => {
        createDefaultPropertyTest(bugsplat, "appName", appName);
    });

    it("should append appVersion to post form", () => {
        createDefaultPropertyTest(bugsplat, "appVersion", appVersion);
    });

    it("should append callstack to post form", () => {
        const expectedError = new Error("BugSplat!");
        const appendSpy = jasmine.createSpy("append").and.stub();
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(null, { statusCode: 200 }, fakeSuccessReponseBody), appendSpy));

        bugsplat.post(expectedError, {}, (requestError, responseBody, originalError) => {});
        expect(appendSpy).toHaveBeenCalledWith("callstack", expectedError.stack);
    });

    it("should log an error if asked to upload a file that doesn't exist", () => {
        const dummyFileName = "foobar.txt";
        const consoleSpy = spyOn(console, "error");
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(null, { statusCode: 200 }, fakeSuccessReponseBody)))

        bugsplat.addAdditionalFile(dummyFileName);
        bugsplat.post(new Error("dummy"));

        expect(consoleSpy).toHaveBeenCalledWith("BugSplat file doesn't exist at path:", dummyFileName);
    });

    it("should log an error if asked to upload a file greater than 1 MB", () => {
        const largeFileName = "./spec/files/1mbplus.txt";
        const additionalFileName = "./spec/files/additionalFile.txt";
        const consoleSpy = spyOn(console, "error");
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(null, { statusCode: 200 }, fakeSuccessReponseBody)));

        bugsplat.addAdditionalFile(additionalFileName);
        bugsplat.addAdditionalFile(largeFileName);
        bugsplat.addAdditionalFile(additionalFileName);
        bugsplat.post(new Error("dummy"));

        const expectedMessage = "BugSplat upload limit of 1MB exceeded, skipping file:";
        expect(consoleSpy).toHaveBeenCalledWith(expectedMessage, largeFileName);
        expect(consoleSpy).not.toHaveBeenCalledWith(expectedMessage, additionalFileName)
    });

    it("should call the callback function", (done) => {
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(null, { statusCode: 200 }, fakeSuccessReponseBody)));

        bugsplat.post(new Error("dummy"), {}, (requestError, responseBody, originalError) => done());
    });

    it("should pass originalError to callback if post is successful", (done) => {
        const errorToPost = new Error("foobar!");
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(null, { statusCode: 200 }, fakeSuccessReponseBody)));

        bugsplat.post(errorToPost, {}, function (requestError, responseBody, originalError) {
            expect(responseBody.status).toEqual(expectedStatus);
            expect(responseBody.crash_id).toEqual(expectedCrashId);
            expect(originalError.message).toEqual(errorToPost.message);
            done();
        });
    });

    it("should pass originalError to callback if post returns a request error", (done) => {
        const expectedRequestError = new Error("couldn't establish a connection");
        const errorToPost = new Error("foobar!");
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(expectedRequestError, null, null)));

        bugsplat.post(errorToPost, {}, function (requestError, responseBody, originalError) {
            expect(requestError.message).toEqual(expectedRequestError.message);
            expect(originalError.message).toEqual(errorToPost.message);
            done();
        });
    });

    function createDefaultPropertyTest(bugsplat, propertyName, propertyValue, propertySetter = (value) => {}) {
        const appendSpy = jasmine.createSpy("append").and.stub();
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(null, { statusCode: 200 }, fakeSuccessReponseBody), appendSpy));

        propertySetter(propertyValue);
        bugsplat.post(new Error("foobar!"), {}, (requestError, responseBody, originalError) => { });

        expect(appendSpy).toHaveBeenCalledWith(propertyName, propertyValue);
    }

    function createOptionsOverrideTest(bugsplat, postOptions, propertyName, propertyValue) {
        const appendSpy = jasmine.createSpy("append").and.stub();
        const postSpy = spyOn(bugsplat._request, "post")
            .and.callFake(createFakePostFunction((requestCallback) => requestCallback(null, { statusCode: 200 }, fakeSuccessReponseBody), appendSpy));

        bugsplat.post(new Error("foobar!"), postOptions, (requestError, responseBody, originalError) => { });

        expect(appendSpy).toHaveBeenCalledWith(propertyName, propertyValue);
    }

    function createFakePostFunction(invokeCallback, appendSpy) {
        return function (options, requestCallback) {
            invokeCallback(requestCallback);
            return {
                form: function () {
                    return {
                        append: appendSpy || function (key, value) { },
                    };
                }
            };
        }
    }
});