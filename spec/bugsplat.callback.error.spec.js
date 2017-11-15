// This test was extracted to it's own file and is run stand-alone due to bug where mocks from mock-require aren't cleared
const mock = require("mock-require");

describe("BugSplat", function() {
    it("should pass originalError to callback if request.post returns a request error", (done) => {
        const expectedRequestError = new Error("couldn't establish a connection");
        const errorToPost = new Error("foobar!");
        mock("request", {
            post: function (options, callback) {
                callback(expectedRequestError, null, null);
                return {
                    form: function () {
                        return {
                            append: function (key, value) { },
                        };
                    }
                };
            }
        });
        const bugsplat = require("../bugsplat")("fred", "myJavaScriptCrasher", "1.0.0.0");
        mock.reRequire("../bugsplat");
        bugsplat.setCallback(function (requestError, responseBody, originalError) {
            expect(requestError.message).toEqual(expectedRequestError.message);
            expect(originalError.message).toEqual(errorToPost.message);
            done();
        });
        bugsplat.post(errorToPost);
    });
});