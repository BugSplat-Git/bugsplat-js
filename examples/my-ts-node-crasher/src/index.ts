import { BugSplatNode } from "bugsplat/node";

const bugsplat = new BugSplatNode("fred", "my-ts-node-crasher", "1.0.0");

// Pass --with-cause (npm run start:with-cause) to post an Error that has a cause
if (process.argv.includes("--with-cause")) {
  crashWithCause();
} else {
  stackFrame0();
}

function stackFrame0() {
  stackFrame1();
}

function stackFrame1() {
  crash();
}

function crash() {
  bugsplat.post(new Error("BugSplat rocks!"));
}

function crashWithCause() {
  try {
    loadUserSettings();
  } catch (error) {
    bugsplat.post(error as Error);
  }
}

function loadUserSettings() {
  try {
    JSON.parse("{ not valid json");
  } catch (error) {
    throw new Error("Failed to load user settings", { cause: error });
  }
}
