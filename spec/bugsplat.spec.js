describe("BugSplat", function () {

    it("should throw exception if user doesn't supply a database", () => {
        try {
            const bugsplat = require("../bugsplat")();
        } catch (err) {
            expect(err.message).toContain("no database was specified!");
        }
    });

    it("should throw exception if user doesn't supply an appName", () => {
        try {
            const bugsplat = require("../bugsplat")("fred");
        } catch (err) {
            expect(err.message).toContain("no appName was specified!");
        }
    });

    it("should throw exception if user doesn't supply an appVersion", () => {
        try {
            const bugsplat = require("../bugsplat")("fred", "myJavaScriptCrasher");
        } catch (err) {
            expect(err.message).toContain("no appVersion was specified!");
        }
    });

    it("should log an error if asked to upload a file that doesn't exist", () => {
        const bugsplat = require("../bugsplat")("fred", "myJavaScriptCrasher", "1.0.0.0");
        const dummyFileName = "foobar.txt";
        bugsplat.setAppKey("UnitTests");
        bugsplat.addAdditionalFile(dummyFileName);

        spyOn(console, "error");
        bugsplat.post(new Error("dummy"));

        expect(console.error).toHaveBeenCalledWith("BugSplat file doesn't exist at path:", dummyFileName);
    });

    it("should log an error if asked to upload a file greater than 1 MB", () => {
        const bugsplat = require("../bugsplat")("fred", "myJavaScriptCrasher", "1.0.0.0");
        const largeFileName = "./spec/files/1mbplus.txt";
        const additionalFileName = "./spec/files/additionalFile.txt";
        bugsplat.setAppKey("UnitTests");
        bugsplat.addAdditionalFile(additionalFileName);
        bugsplat.addAdditionalFile(largeFileName);
        bugsplat.addAdditionalFile(additionalFileName);

        spyOn(console, "error");
        bugsplat.post(new Error("dummy"));

        const expectedMessage = "BugSplat upload limit of 1MB exceeded, skipping file:";
        expect(console.error).toHaveBeenCalledWith(expectedMessage, largeFileName);
        expect(console.error).not.toHaveBeenCalledWith(expectedMessage, additionalFileName)
    });

    it("should call the callback function", (done) => {
        const bugsplat = require("../bugsplat")("fred", "myJavaScriptCrasher", "1.0.0.0");
        bugsplat.setCallback(function (err, body) {
            done(); // If done is not called the test times out and fails
        });

        bugsplat.post(new Error("dummy"));
    });
});