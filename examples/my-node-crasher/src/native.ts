// Required: Initialize bugsplat with database name, app name, and version
import { BugSplatNode } from "bugsplat/node";

const bugsplat = new BugSplatNode("fred", "my-node-crasher", "1.0.0.0");
bugsplat.setDefaultAppKey("AppKey");
bugsplat.setDefaultUser("Fred");
bugsplat.setDefaultEmail("fred@bedrock.com");
bugsplat.setDefaultDescription("description");

// Create a native report from an error
const error = new Error("BugSplat rocks!");
process.report.writeReport("report.json", error);

// Send the error to BugSplat and attach the native report
const result = await bugsplat.post(error, { additionalFilePaths: ["./report.json"] });
console.log(result);
