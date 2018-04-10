// This test was extracted to it's own file and is run stand-alone due to bug where mocks from mock-require aren't cleared
const mock = require("mock-require");

describe("BugSplat", function() {
    it("should pass originalError to callback if request.post is successful", (done) => {
        const expectedStatus = "success";
        const expectedCrashId = 73180;
        const expectedResponseBody = "{ \"status\": \"" + expectedStatus + "\", \"crash_id\": " + expectedCrashId + " }";
        const errorToPost = new Error("foobar!");
        mock("request", {
            post: function (options, callback) {
                callback(null, { statusCode: 200 }, expectedResponseBody);
                return {
                    form: function () {
                        return {
                            append: function (key, value) { },
                        };
                    }
                };
            },
        });
        const bugsplat = require("../bugsplat")("fred", "myJavaScriptCrasher", "1.0.0.0");
        mock.reRequire("../bugsplat");
        bugsplat.post(errorToPost, function (requestError, responseBody, originalError) {
            expect(responseBody.status).toEqual(expectedStatus);
            expect(responseBody.crash_id).toEqual(expectedCrashId);
            expect(originalError.message).toEqual(errorToPost.message);
            done();
        });
    });
});