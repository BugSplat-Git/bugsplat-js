// my-node-crasher
// https://www.npmjs.com/package/bugsplat
// support@bugsplat.com

// Required: Initialize bugsplat with database name, app name, and version
import { BugSplatNode } from "bugsplat/node";

const bugsplat = new BugSplatNode("fred", "my-node-crasher", "1.0.0.0");

// Recommended: Functions that allow further customization
bugsplat.setDefaultAppKey("AppKey");
bugsplat.setDefaultUser("Fred");
bugsplat.setDefaultEmail("fred@bedrock.com");
bugsplat.setDefaultDescription("description");
bugsplat.setDefaultAdditionalFilePaths(["./additionalFile.txt"]);

// Recommended: Post to BugSplat when unhandledRejections and uncaughtExceptions occur
process.on("uncaughtException", async (error) => await bugsplat.postAndExit(error));
process.on("unhandledRejection", async (reason) => await bugsplat.postAndExit(reason as Error));

// Optional: Send an Error to BugSplat manually
// const { error, response, original } = await bugsplat.post(new Error("foobar!"), {
//     appKey: "NewAppKey",
//     user: "Barney",
//     email: "barney@bedrock.com",
//     description: "new description",
//     additionalFilePaths: ["./additionalFile2.txt"]
// });
// error will be null or an error object that was thrown while attempting to post to BugSplat
// response is the response from posting the crash to the BugSplat API
// original contains the error that was passed to bugsplat.post

// Trigger an uncaughtException or unhandledRejection to test BugSplat
// Pass --with-cause (npm run start:with-cause) to throw an Error that has a cause
if (process.argv.includes("--with-cause")) {
    crashWithCause();
} else {
    uncaughtException();
}
//unhandledRejection();

function uncaughtException(): void {
    generateStackFramesAndCrash();
}

function unhandledRejection(): Promise<never> {
    return Promise.resolve("foo")
        .then((foo) => foo + "bar!")
        .then((foobar) => Promise.reject(new Error(foobar)));
}

function crashWithCause(): void {
    loadUserSettings();
}

function loadUserSettings(): void {
    try {
        JSON.parse("{ not valid json");
    } catch (error) {
        throw new Error("Failed to load user settings", { cause: error });
    }
}

function generateStackFramesAndCrash(): void {
    stackFrame0();
}

function stackFrame0(): void {
    stackFrame1();
}

function stackFrame1(): void {
    stackFrame2();
}

function stackFrame2(): void {
    crash();
}

function crash(): never {
    throw new Error("foobar!");
}
