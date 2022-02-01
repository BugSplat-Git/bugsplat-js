import {
    BugSplatApiClient,
    CrashApiClient,
    Environment,
} from '@bugsplat/js-api-client';
import * as fs from 'fs';
import * as path from 'path';
import { BugSplat } from '../src/bugsplat';
const email = 'fred@bugsplat.com';
const password = process.env.FRED_PASSWORD;
const appBaseUrl = 'https://app.bugsplat.com';

describe('BugSplat', () => {
    let client: CrashApiClient;

    beforeEach(async () => {
        if (!password) {
            throw new Error('Please set FRED_PASSWORD environment variable');
        }

        const api = new BugSplatApiClient(appBaseUrl, Environment.Node);
        await api.login(email, password);
        client = new CrashApiClient(api);
    });

    it('should post a crash report with all provided information', async () => {
        const database = 'fred';
        const appName = 'my-node-crasher';
        const appVersion = '1.2.3.4';
        const error = new Error('BugSplat!!');
        const appKey = 'Key!';
        const user = 'User!';
        const email = 'fred@bedrock.com';
        const description = 'Description!';
        const additionalFile = './spec/files/additionalFile.txt';
        const fileName = path.basename(additionalFile);
        const fileContents = fs.createReadStream(additionalFile);
        const additionalFormDataParams = <any>[
            { key: fileName, value: fileContents },
        ];
        const bugsplat = new BugSplat(database, appName, appVersion);
        bugsplat.setDefaultAppKey(appKey);
        bugsplat.setDefaultUser(user);
        bugsplat.setDefaultEmail(email);
        bugsplat.setDefaultDescription(description);

        const result = await bugsplat.post(error, { additionalFormDataParams });
        if (result.error) {
            throw new Error(result.error.message);
        }

        const expectedCrashId = result.response.crash_id;
        const crashData = await client.getCrashById(database, expectedCrashId);
        expect(crashData.appName).toEqual(appName);
        expect(crashData.appVersion).toEqual(appVersion);
        expect(crashData.appKey).toEqual(appKey);
        expect(crashData.description).toEqual(description);
        expect(crashData.user).toBeTruthy(); // Fred has PII obfuscated so the best we can do here is to check if truthy
        expect(crashData.email).toBeTruthy(); // Fred has PII obfuscated so the best we can do here is to check if truthy
    }, 30000);

    it('should post a crash if errorToPost is not an Error object', async () => {
        const database = 'fred';
        const appName = 'my-node-crasher';
        const appVersion = '4.3.2.1';
        const errorToPost = <any>'error!';
        const bugsplat = new BugSplat(database, appName, appVersion);

        const result = await bugsplat.post(errorToPost, {});
        if (result.error) {
            throw new Error(result.error.message);
        }
        const expectedCrashId = result.response.crash_id;
        const crashData = await client.getCrashById(database, expectedCrashId);

        expect(crashData.appName).toEqual(appName);
        expect(crashData.appVersion).toEqual(appVersion);
    }, 10000);
});
