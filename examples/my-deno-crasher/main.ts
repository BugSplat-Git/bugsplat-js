import { BugSplat } from 'https://esm.sh/bugsplat@9.2.0';

const description = "test crash from deno!";
const key = "en-US";
const email = "bobby@bugsplat.com";
const user = "Bobby";

const bugsplat = new BugSplat("Fred", "my-deno-crasher", "1.0");
bugsplat.setDefaultAppKey(key);
bugsplat.setDefaultDescription(description);
bugsplat.setDefaultEmail(email);
bugsplat.setDefaultUser(user);

try {
  if (Deno.args.includes("--with-cause")) {
    crashWithCause();
  } else {
    generateExampleStackFrames();
  }
} catch (error) {
  await bugsplat.post(error as Error, getAdditionalOptionsWithLogFile());
}

function crash() {
  throw new Error("BugSplat rocks!");
}

function generateExampleStackFrames() {
  sampleStackFrame0();
}

function sampleStackFrame0() {
  sampleStackFrame1();
}

function sampleStackFrame1() {
  sampleStackFrame2();
}

function sampleStackFrame2() {
  crash();
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

function getAdditionalOptionsWithLogFile() {
  const filename = 'log.txt';
  return {
    attachments: [{
      filename,
      data: new File([Deno.readFileSync(filename)], filename),
    }],
  };
}