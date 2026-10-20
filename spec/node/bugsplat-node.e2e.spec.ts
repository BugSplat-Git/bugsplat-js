import { BugSplatApiClient, CrashApiClient } from '@bugsplat/js-api-client';
import { config } from 'dotenv';
import { BugSplatNode } from '../../src/node/index';

config();

const email = 'fred@bugsplat.com';
const password = process.env.FRED_PASSWORD;

describe('BugSplatNode', () => {
    let client: CrashApiClient;

    beforeEach(async () => {
        if (!password) {
            throw new Error('Please set FRED_PASSWORD environment variable');
        }

        const api = await BugSplatApiClient.createAuthenticatedClientForNode(
            email,
            password
        );
        client = new CrashApiClient(api);

        // Posting too frequently results in 400s from the web server
        await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    it('posts a crash report with a file attachment read from disk', async () => {
        const database = 'fred';
        const appName = 'my-node-crasher';
        const appVersion = '1.2.3.4';
        const appKey = 'Key!';
        const description = 'Description!';
        const bugsplat = new BugSplatNode(database, appName, appVersion);
        bugsplat.setDefaultAppKey(appKey);
        bugsplat.setDefaultUser('User!');
        bugsplat.setDefaultEmail('fred@bedrock.com');
        bugsplat.setDefaultDescription(description);
        bugsplat.setDefaultAdditionalFilePaths(['./spec/files/additionalFile.txt']);

        const result = await bugsplat.post(new Error('BugSplat!!'));

        if (result.error) {
            throw result.error;
        }

        const crashData = await client.getCrashById(database, result.response.crash_id);
        expect(crashData.appName).toEqual(appName);
        expect(crashData.appVersion).toEqual(appVersion);
        expect(crashData.appKey).toEqual(appKey);
        expect(crashData.description).toEqual(description);
        expect(crashData.user).toBeTruthy(); // Fred has PII obfuscated so the best we can do here is to check if truthy
        expect(crashData.email).toBeTruthy(); // Fred has PII obfuscated so the best we can do here is to check if truthy
    });

    it('posts user feedback with a file attachment read from disk', async () => {
        const bugsplat = new BugSplatNode('fred', 'my-node-crasher', '1.2.3.4');
        bugsplat.setDefaultUser('User!');
        bugsplat.setDefaultEmail('fred@bedrock.com');

        const result = await bugsplat.postFeedback('Login button broken', {
            description: 'Nothing happens when I tap it',
            additionalFilePaths: ['./spec/files/additionalFile.txt'],
        });

        if (result.error) {
            throw result.error;
        }

        expect(result.response.status).toEqual('success');
        expect(result.response.crash_id).toBeGreaterThan(0);
    });
});
