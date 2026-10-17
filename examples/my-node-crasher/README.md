[![BugSplat](https://s3.amazonaws.com/bugsplat-public/npm/header.png)](https://www.bugsplat.com)

## my-node-crasher

> History for this sample lives in the archived [my-node-crasher](https://github.com/BugSplat-Git/my-node-crasher) repository.

This sample shows how to use the `bugsplat/node` entry point of BugSplat's [npm package](https://www.npmjs.com/package/bugsplat) in a Node.js application.
1. Clone the [bugsplat-js](https://github.com/BugSplat-Git/bugsplat-js) repository
2. Open terminal or command prompt in `examples/my-node-crasher`
3. ```npm i && npm run start```
4. Navigate to BugSplat's [Crash](https://app.bugsplat.com/v2/crashes) page in your web browser
5. When prompted to log in, use the username "Fred@bugsplat.com" and password "Flintstone"
6. Click the ID of your crash to see crash details

To post an error that has a `cause`, run `npm run start:with-cause` instead of `npm run start`. The error has a `cause`; bugsplat 9.2.0 posts the whole chain and BugSplat shows each linked error as a `Caused by:` row.

`npm run native` writes a Node.js diagnostic report with `process.report.writeReport()` and posts it as an attachment via `additionalFilePaths`.

For additional help, check out the [documentation](http://www.bugsplat.com/docs/) on our website or email support(at)bugsplat.com if you have any questions.

Good luck!
© BugSplat Software
[Web](https://www.bugsplat.com) | [Twitter](https://twitter.com/BugSplatCo) | [Facebook](https://www.facebook.com/bugsplatsoftware/)
