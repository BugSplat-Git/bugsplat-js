// my-node-crasher
// https://www.npmjs.com/package/bugsplat
// support@bugsplat.com

// Required: Initialize bugsplat with database name, app name, and version
const { BugSplatNode } = require("bugsplat/node");
const bugsplat = new BugSplatNode("fred", "my-node-crasher", "1.0.0.0");

// Recommended: Functions that allow further customization
bugsplat.setDefaultAppKey("AppKey");
bugsplat.setDefaultUser("Fred");
bugsplat.setDefaultEmail("fred@bedrock.com");
bugsplat.setDefaultDescription("description");
bugsplat.setDefaultAdditionalFilePaths(["./additionalFile.txt"]);

// Recommended: Post to BugSplat when unhandledRejections and uncaughtExceptions occur
process.on("uncaughtException", async (error) => await bugsplat.postAndExit(error));
process.on("unhandledRejection", async (error) => await bugsplat.postAndExit(error));

// Optional: Send an Error to BugSplat manually
// bugsplat.post(new Error("foobar!"), {
//     appKey: "NewAppKey",
//     user: "Barney",
//     email: "barney@bedrock.com",
//     description: "new description",
//     additionalFilePaths: ["./additionalFile2.txt"]
// }).then(({ error, response, original }) => {
//     // error will be null or an error object that was thrown while attempting to post to BugSplat
//     // response is the response from posting the crash to the BugSplat API 
//     // original contains the error that was passed to bugsplat.post
//     process.exit(1);
// });

// Trigger an uncaughtException or unhandledRejection to test BugSplat
// Pass --with-cause (npm run start:with-cause) to throw an Error that has a cause
if (process.argv.includes("--with-cause")) {
    crashWithCause();
} else {
    uncaughtException();
}
//unhandledRejection();

function uncaughtException() {
    generateStackFramesAndCrash();
}

function unhandledRejection() {
    return new Promise((resolve, reject) => resolve("foo"))
        .then(foo => new Promise((resolve, reject) => resolve(foo + "bar!")))
        .then(foobar => new Promise((resolve, reject) => reject(new Error(foobar))));
}

function crashWithCause() {
    loadUserSettings();
}

function loadUserSettings() {
    try {
        JSON.parse("{ not valid json");
    } catch (error) {
        throw new Error("Failed to load user settings", { cause: error });
    }
}

function generateStackFramesAndCrash() {
    stackFrame0();
}

function stackFrame0() {
    stackFrame1();
}

function stackFrame1() {
    stackFrame2();
}

function stackFrame2() {
    crash();
}

function crash() {
    throw new Error("foobar!");
}