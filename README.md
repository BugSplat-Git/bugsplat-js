[![BugSplat](https://s3.amazonaws.com/bugsplat-public/npm/header.png)](https://www.bugsplat.com)

![travis-ci](https://travis-ci.org/bobbyg603/bugsplat-js.svg?branch=master)
## Introduction
BugSplat's JavaScript integration works with applications that support npm including Node.js, and Electron. Before continuing with the tutorial please make sure you have completed the following checklist:
* [Register](http://www.bugsplat.com/account-registration/) as a new BugSplat user.
* [Log in](https://www.bugsplat.com/user-login/) using your email address.

## Configuration
To add the bugsplat package to your application, run the following shell command at the root of your project’s directory:
```shell
npm install --save bugsplat
```
Require the bugsplat module at the entry point of your application. Provide the name of your BugSplat database, the name of your application and the version of your application:
 ```js
 const bugsplat = require("bugsplat")("DatabaseName", "ApplicationName", "1.0.0.0");
 ```
Set the bugsplat.post function as an event handler for uncaught exceptions:
```js
process.on("uncaughtException", bugsplat.post);
```
If your application uses promises you will also want to listen for unhandled promise rejections. Please note that this will only work for native promises:
```js
process.on("unhandledRejection", bugsplat.post);
```
Throw an exception after the event handler has been added. 
```js
throw new Error("BugSplat!"));
```
Navigate to the [All Crashes](https://www.bugsplat.com/allCrash/) page in BugSplat and you should see a new crash report for the application you just configured. Click the link in the Id column to see details about your crash on the [Individual Crash](https://www.bugsplat.com/individualCrash/?id=405) page:

![AllCrash](https://s3.amazonaws.com/bugsplat-public/npm/allCrash.png)
![IndividualCrash](https://s3.amazonaws.com/bugsplat-public/npm/individualCrash.png)

That’s it! Your application is now configured to post crash reports to BugSplat.

## API
In addition to the configuration demonstrated above, there are a few public methods that can be used to customize your BugSplat integration:
```js
bugsplat.setAppKey(appKey); // A unique identifier for your application
bugsplat.setUser(user); // The name or id of your user
bugsplat.setEmail(email); // The email of your user
bugsplat.setDescription(description); // Additional info about your crash that gets reset after every post
bugsplat.addAdditionalFile(pathToFile); // Path to a file to be added at post time (limit 1MB)
bugsplat.setCallback(callback); // Function that accepts 2 parameters (err, responseBody) that runs after post
bugsplat.post(error); // Post an arbitrary Error object to BugSplat
```
## Contributing
BugSplat loves open source software! Please check out our project on [GitHub](https://github.com/bobbyg603/bugsplat-js) and send us a pull request.