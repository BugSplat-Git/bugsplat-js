[![bugsplat-github-banner-basic-outline](https://user-images.githubusercontent.com/20464226/149019306-3186103c-5315-4dad-a499-4fd1df408475.png)](https://bugsplat.com)
<br/>
# <div align="center">BugSplat</div> 
### **<div align="center">Crash and error reporting built for web developers.</div>**
<div align="center">
    <a href="https://twitter.com/BugSplatCo">
        <img alt="Follow @bugsplatco on Twitter" src="https://img.shields.io/twitter/follow/bugsplatco?label=Follow%20BugSplat&style=social">
    </a>
    <a href="https://discord.gg/K4KjjRV5ve">
        <img alt="Join BugSplat on Discord" src="https://img.shields.io/discord/664965194799251487?label=Join%20Discord&logo=Discord&style=social">
    </a>
</div>

# my-javascript-crasher

> History for this sample lives in the archived [my-javascript-crasher](https://github.com/BugSplat-Git/my-javascript-crasher) repository.

This sample project demonstrates how to use the [bugsplat](https://github.com/BugSplat-Git/bugsplat-js) package to report JavaScript errors in web applications. Before continuing with the tutorial please make sure you have completed the following checklist:

* [Sign Up](https://app.bugsplat.com/v2/sign-up) as a new BugSplat user.
* [Log In](https://app.bugsplat.com/cognito/login) using your email address.

## ⚙️ Integrating

Import [bugsplat](https://github.com/BugSplat-Git/bugsplat-js) from [esm.sh](https://esm.sh)

```html
<script type="module">
    import { BugSplat } from 'https://esm.sh/bugsplat@9.2.0';
</script>
```

Create a new instance of BugSplat with your database, application, and version

```javascript
const bugsplat = new BugSplat('fred', 'my-javascript-crasher', '1.0.0');
```

Configure bugsplat to listen to `window.onerror` and `window.onunhandledrejection` events

```javascript
window.onerror = function (message, source, lineno, colno, error) {
    bugsplat.post(error);
};

window.addEventListener('unhandledrejection', function (event) {
    bugsplat.post(event.reason);
});
```

Trigger an error to see it reported in BugSplat

```javascript
throw new Error('todo bg');
```

## 🧪 Sample

Clone the [bugsplat-js](https://github.com/BugSplat-Git/bugsplat-js) repository and change into this example's directory

```sh
git clone https://github.com/BugSplat-Git/bugsplat-js
cd bugsplat-js/examples/my-javascript-crasher
```

Install the dependencies

```sh
npm i
```

Start the server

```sh
npm start
```

Open your browser and navigate to [http://localhost:8080](http://localhost:8080), then click the button to trigger an error.

Click **Crash with cause** to throw an error whose `cause` is a `SyntaxError` from `JSON.parse`. The error has a `cause`; bugsplat 9.2.0 posts the whole chain and BugSplat shows each linked error as a `Caused by:` row.

## 📈 Viewing Reports

Navigate to the BugSplat [Crashes](https://app.bugsplat.com/v2/crashes?database=Fred&c0=appName&f0=CONTAINS&v0=my-javascript-crasher) page to view your report.

![Crashes page](https://github.com/BugSplat-Git/my-javascript-crasher/assets/2646053/af6950bb-530b-42da-8679-47f220f08a40)

Click on the ID of the most recent error to view the details of your report.

![Crash page](https://github.com/BugSplat-Git/my-javascript-crasher/assets/2646053/acc8fa5c-b93e-4037-a72e-ea39f3437b8e)


