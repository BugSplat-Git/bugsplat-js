[![bugsplat-github-banner-basic-outline](https://user-images.githubusercontent.com/20464226/149019306-3186103c-5315-4dad-a499-4fd1df408475.png)](https://bugsplat.com)
<br/>
# <div align="center">BugSplat</div> 
### **<div align="center">Crash and error reporting built for busy developers.</div>**
<div align="center">
    <a href="https://twitter.com/BugSplatCo">
        <img alt="Follow @bugsplatco on Twitter" src="https://img.shields.io/twitter/follow/bugsplatco?label=Follow%20BugSplat&style=social">
    </a>
    <a href="https://discord.gg/K4KjjRV5ve">
        <img alt="Join BugSplat on Discord" src="https://img.shields.io/discord/664965194799251487?label=Join%20Discord&logo=Discord&style=social">
    </a>
</div>

## 👋 Introduction

BugSplat-js is a JavaScript error-reporting system for web applications. Before continuing with the tutorial, please make sure you have completed the following checklist:
* [Sign Up](https://app.bugsplat.com/v2/sign-up) as a new BugSplat user.
* [Log In](https://app.bugsplat.com/auth0/login) using your email address.

## 🏗 Installation

Install `bugsplat` via npm. This package currently requires Node.js 18 or later.

```sh
npm i bugsplat --save
```

If you need to use a version of Node.js older than 18, you can install bugsplat@7.1.4.

## ⚙️ Configuration

Depending on your project's module system, you can either `import` or `require` BugSplat:

### ESM
```ts
import { BugSplat } from 'bugsplat';
```

### CommonJS
```ts
const { BugSplat } = require('bugsplat');
```

### Node.js
Node.js programs import the same client from `bugsplat/node`, which adds file attachments read from disk and a helper that exits the process after the report is posted:
```ts
import { BugSplatNode } from 'bugsplat/node';

const bugsplat = new BugSplatNode(database, application, version);
bugsplat.setDefaultAdditionalFilePaths(['/var/log/my-app.log']);

process.on('uncaughtException', (error) => bugsplat.postAndExit(error));
process.on('unhandledRejection', (reason) => bugsplat.post(reason as Error));
```

`post()` and `postFeedback()` accept `additionalFilePaths` alongside the usual options. Files are uploaded under their base name; missing files are skipped, as are files that would push the upload past 10 MB.

Create a new instance of the BugSplat class with the name of your BugSplat database, the name of your application and the version of your application:
```ts
const bugsplat = new BugSplat(database, application, version);
```

Listen for `window.onerror` events and post them to BugSplat:
```ts
window.onerror = async (event, source, lineno, colno, error) => {
  await bugsplat.post(error);
}
```

Also listen for `window.unhandledpromiserejection` events and post them to BugSplat:
```ts
window.onunhandledrejection = async (rejection) => {
  await bugsplat.post(rejection.reason)
}
```

Throw an exception after the event handler has been added. 
```ts
throw new Error('BugSplat!');
```

You can use bugsplat-js to capture errors that originate inside of try-catch blocks:
```ts
try {
    throw new Error('BugSplat');
} catch(error) {
    await bugsplat.post(error);
}
```

You can also use bugsplat-js to post errors from promise rejections:
```ts
Promise.reject(new Error('BugSplat!')).catch(error => bugsplat.post(error, {}));
```

## ✅ Verification

After posting an error with bugsplat-js, navigate to the [Crashes](https://app.bugsplat.com/v2/crashes?database=Fred&c0=appName&f0=CONTAINS&v0=my-react-crasher) page. You should see a new crash report for the application you just configured. Click the link in the ID column to see details about your crash on the [Crash](https://app.bugsplat.com/v2/crash?database=Fred&id=94338) page:

![Crashes](https://github.com/BugSplat-Git/bugsplat-js/assets/2646053/ae9acf37-5e1e-4436-9513-4543ad9c16d1)
![Crash](https://github.com/BugSplat-Git/bugsplat-js/assets/2646053/8338a4db-891d-4ca6-96f6-c3e8222098ae)

That’s it! Your application is now configured to post crash reports to BugSplat.

## 🧪 Examples

Runnable samples live in [`examples/`](examples). Run each command from the example's own directory (for example `cd examples/my-node-crasher`). Every sample has a "Crash with cause" variant that throws an `Error` whose `cause` is a `SyntaxError` from `JSON.parse`, so you can see the chain in BugSplat as `Caused by:` rows.

- [my-javascript-crasher](examples/my-javascript-crasher) — vanilla browser app importing `bugsplat` from esm.sh. `npm i && npm start`, open [http://localhost:8080](http://localhost:8080) and click **Error**, **Type Error**, **Unhandled Rejection** or **Crash with cause**.
- [my-node-crasher](examples/my-node-crasher) — TypeScript Node.js app using `BugSplatNode` from `bugsplat/node`, run directly by Node 22.18+ with no build step. `npm i && npm start`, or `npm run start:with-cause`; `npm run native` attaches a Node.js diagnostic report.

The Node example depends on `bugsplat@^9.3.0`, the first release with the `bugsplat/node` entry point.

## 🧩 API

In addition to the configuration demonstrated above, there are a few public methods that can be used to customize your BugSplat integration:
```ts
bugsplat.setDefaultAppKey(appKey); // Additional metadata that can be queried via BugSplat's web application
bugsplat.setDefaultUser(user); // The name or id of your user
bugsplat.setDefaultEmail(email); // The email of your user
bugsplat.setDefaultDescription(description); // Additional info about your crash that gets reset after every post
async bugsplat.post(error, options); // Posts an arbitrary Error object to BugSplat
// If the values options.appKey, options.user, options.email, options.description are set the corresponding default values will be overwritten
// Returns a promise that resolves with properties: error (if there was an error posting to BugSplat), response (the response from the BugSplat crash post API), and original (the error passed by bugsplat.post)
```

### Error chains

When the error you post has a `cause` (or is an `AggregateError` with `errors`), bugsplat-js walks the chain automatically and posts it as the crash report: the posted error plus up to 100 linked entries, in discovery order (`cause` before `errors[]`, depth-first), in at most 1 MB. Linked errors appear in BugSplat's callstack as `Caused by:` rows followed by their own stacks, with each error's own properties (for example a database driver's `code` or `constraint`) shown as locals. There's nothing to configure.

```ts
try {
    await db.insert(users).values(user);
} catch (error) {
    // The driver error on `error.cause` (SQLSTATE, constraint name, ...) is captured too
    await bugsplat.post(error);
}
```

If you need the chain for your own tooling, `createExceptionChain(error)` returns the same entries `post()` sends.

`post()` sends the chain as JSON in the `exceptions` form field. `exceptions` holds one object per error with `id`, `parentId`, `source`, `type`, `message`, `stack` and `properties`. `debugMeta` is added next to it when a file named in one of the stacks has a [source map debug ID](#source-map-debug-ids):

```json
{
  "exceptions": [
    {
      "id": 0,
      "parentId": null,
      "source": null,
      "type": "TypeError",
      "message": "x is not a function",
      "stack": "TypeError: x is not a function\n    at render (https://example.com/assets/index-BX3k.js:1:2345)",
      "properties": {}
    }
  ],
  "debugMeta": [
    { "file": "https://example.com/assets/index-BX3k.js", "debugId": "9f2c1a7e-3b4d-4c5e-8f60-112233445566" }
  ]
}
```

- `file` is the file exactly as the stack frames name it (same scheme, host, path and query string). `debugId` is the ID as the build wrote it.
- Only files that appear in a stack are listed, starting with the file of the posted error's top frame. The files are matched before the 1 MB limit shortens any stack.
- `debugMeta` is left out when no file in a stack has a debug ID, so the field is then `{ "exceptions": [...] }` and nothing else.
- `debugMeta` counts toward the same 1 MB limit and only uses the room the chain leaves: rows that do not fit are left out, last row first. The chain is never shortened to make room for them.

### Source map debug IDs

A debug ID is a UUID that a build writes into a JavaScript file (`//# debugId=<uuid>`) and into that file's source map (`"debugId": "<uuid>"`). A report that says which debug ID each file in its stacks has can be matched to the source maps of that exact build, whatever the files are called and however many times a version is deployed.

bugsplat-js reads debug IDs from `globalThis._debugIds`. Scripts built with `@bugsplat/build` add themselves to `globalThis._debugIds` as they load: each key is the stack of an `Error` created in the script, and each value is the script's debug ID. `post()` adds the IDs of the files named in the posted stacks to the report as [`debugMeta`](#error-chains). There's nothing to configure, and an application built without debug IDs posts exactly what it posted before.

`getDebugIds()` returns what bugsplat-js read from `globalThis._debugIds`, as file to debug ID:

```ts
import { getDebugIds } from 'bugsplat'; // or from 'bugsplat/node'

getDebugIds();
// { 'https://example.com/assets/index-BX3k.js': '9f2c1a7e-3b4d-4c5e-8f60-112233445566' }
```

When you post an error whose scripts ran in a different JavaScript context (another process, a worker, an iframe), `globalThis._debugIds` in the posting context does not know those scripts. Call `getDebugIds()` in the context that ran them, send the result along with the error, and pass it to `post()` as `debugIds`:

```ts
await bugsplat.post(error, {
    debugIds: {
        'app://./assets/renderer-41fe.js': '0a1b2c3d-4e5f-4a6b-8c7d-8e9f00112233',
    },
});
```

Each key of `debugIds` must be the file exactly as it appears in the error's stack. An entry in `debugIds` takes precedence over the entry for the same file in `globalThis._debugIds`. `postFeedback()` has no stack and ignores `debugIds`.

### User Feedback

You can also submit non-crashing user feedback (e.g. bug reports, feature requests) using `postFeedback`. Feedback reports appear in BugSplat with the "User Feedback" crash type, grouped by `title`.

```ts
const response = await bugsplat.postFeedback('Login button does not respond', {
  description: 'Tapping login on iPhone does nothing.',
  user: 'jane@example.com',
  email: 'jane@example.com',
});
```

You can attach files such as screenshots:

```ts
const screenshot = document.querySelector('input[type="file"]').files[0];

await bugsplat.postFeedback('UI rendering issue', {
  description: 'The sidebar overlaps the main content.',
  attachments: [
    { filename: 'screenshot.png', data: screenshot },
  ],
});
```

## 📢 Upgrading

### From bugsplat-node

[bugsplat-node](https://www.npmjs.com/package/bugsplat-node) is deprecated. Its `BugSplatNode` class ships in this package as `bugsplat/node` with the same API, so the upgrade is the import:

```diff
- import { BugSplatNode } from 'bugsplat-node';
+ import { BugSplatNode } from 'bugsplat/node';
```

Remove `bugsplat-node` from your dependencies and require `bugsplat` 9.3.0 or newer. `additionalFilePaths`, `setDefaultAdditionalFilePaths()` and `postAndExit()` behave as before.

### From bugsplat-js 5 or older in Node.js

File attachments and exiting the process from an error handler moved out of the main entry so that it runs in browsers as well as Node.js. Import from `bugsplat/node` to get them back.

## 🧑‍💻 Contributing

BugSplat loves open source software! Please check out our project on [GitHub](https://github.com/BugSplat-Git/bugsplat-js) and send us a pull request.

## 👷 Support

If you have any additional questions, please email or [support](mailto:support@bugsplat.com) team, join us on [Discord](https://discord.gg/K4KjjRV5ve), or reach out via the chat in our web application.

