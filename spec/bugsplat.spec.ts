import {
    BugSplat,
    createStandardizedCallStack,
    tryParseResponseJson,
} from '../src/bugsplat';

describe('createStandardizedCallStack', () => {
    it('should always return a call stack containing "Error:"', () => {
        const errors = [
            new Error('sample error'),
            new TypeError('sample type error'),
            new SyntaxError('sample syntax error'),
            {
                message: 'fake error message',
                stack: 'fake stack',
            } as Error,
            {
                message: 'fake error message',
                stack: 'Err: bodyoftext',
            } as Error,
            {
                message: 'Error: message',
                stack: 'stacktext',
            } as Error,
        ];

        errors.forEach((error) => {
            const stack = createStandardizedCallStack(error);
            expect(stack).toContain('Error:');
        });
    });
});

describe('tryParseResponseJson', () => {
    const values: unknown[] = [
        12,
        '12',
        [],
        {},
        true,
        [
            { type: 'person', value: { name: 'peter', age: 17 } },
            { type: 'person', value: { name: 'kris', age: 24 } },
        ],
    ];
    it('should return result of json method if no error occurs', async () => {
        const inputs = values.map(async (value) => {
            const result = await tryParseResponseJson({
                json: async () => value,
            });
            expect(result).toBe(value);
        });
        Promise.all(inputs);
    });

    it('should return an empty object if an error occurs', () => {
        const inputs = values.map(async (value) => {
            const result = await tryParseResponseJson({
                json: async () => {
                    throw new Error('parsing error');
                },
            });
            expect(JSON.stringify(result)).toBe('{}');
        });
        Promise.all(inputs);
    });
});

describe('BugSplat', function () {
    const database = 'fred';
    const appName = 'my-node-crasher';
    const appVersion = '1.0.0.0';
    const expectedStatus = 'success';
    const expectedCrashId = 73180;

    let bugsplat;
    let appendSpy;
    let fakeFormData;
    let fakeCrashResponse;
    let fakeSuccessResponseBody;

    beforeEach(() => {
        appendSpy = jasmine.createSpy();
        fakeFormData = { append: appendSpy, toString: () => 'BugSplat rocks!' };
        fakeCrashResponse = {
            status: 'success',
            current_server_time: 1,
            message: 'BugSplat rocks!',
            url: 'bugsplat.rocks/yes-its-true',
            crash_id: expectedCrashId,
        };
        fakeSuccessResponseBody = {
            status: expectedStatus,
            json: async () => fakeCrashResponse,
            ok: true,
        };
        bugsplat = new BugSplat(database, appName, appVersion);
        bugsplat._fetch = jasmine.createSpy();
        bugsplat._formData = () => fakeFormData;
    });

    it('should call append with options.additionalFormDataParams if set', async () => {
        const key = 'attachment.txt';
        const value = '🐶';
        const options = key;
        const additionalFormDataParams = [{ key, value, options }];
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        await bugsplat.post(new Error('BugSplat!'), {
            additionalFormDataParams,
        });

        expect(appendSpy).toHaveBeenCalledWith(key, value, options);
    });

    it('should use default appKey if options.appKey is not set', async () => {
        await createDefaultPropertyTest(
            bugsplat,
            'appKey',
            'defaultAppKey',
            bugsplat.setDefaultAppKey.bind(bugsplat)
        );
    });

    it('should use options.appKey if set', async () => {
        const appKey = 'overridenAppKey';
        await createOptionsOverrideTest(bugsplat, { appKey }, 'appKey', appKey);
    });

    it('should use default user if options.user is not set', async () => {
        await createDefaultPropertyTest(
            bugsplat,
            'user',
            'defaultUser',
            bugsplat.setDefaultUser.bind(bugsplat)
        );
    });

    it('should use options.user if set', async () => {
        const user = 'overridenUser';
        await createOptionsOverrideTest(bugsplat, { user }, 'user', user);
    });

    it('should use default email if options.email is not set', async () => {
        await createDefaultPropertyTest(
            bugsplat,
            'email',
            'defaultEmail',
            bugsplat.setDefaultEmail.bind(bugsplat)
        );
    });

    it('should use options.email if set', async () => {
        const email = 'overridenEmail';
        await createOptionsOverrideTest(bugsplat, { email }, 'email', email);
    });

    it('should use default description if options.description is not set', async () => {
        await createDefaultPropertyTest(
            bugsplat,
            'description',
            'defaultDescription',
            bugsplat.setDefaultDescription.bind(bugsplat)
        );
    });

    it('should use options.description if set', async () => {
        const description = 'overridenDescription';
        await createOptionsOverrideTest(
            bugsplat,
            { description },
            'description',
            description
        );
    });

    it('should append database to post body', async () => {
        await createDefaultPropertyTest(bugsplat, 'database', database);
    });

    it('should append appName to post body', async () => {
        await createDefaultPropertyTest(bugsplat, 'appName', appName);
    });

    it('should append appVersion to post body', async () => {
        await createDefaultPropertyTest(bugsplat, 'appVersion', appVersion);
    });

    it('should append callstack to post body', async () => {
        const expectedError = new Error('BugSplat!');
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        await bugsplat.post(expectedError, {});

        expect(appendSpy).toHaveBeenCalledWith(
            'callstack',
            expectedError.stack
        );
    });

    it('should create a stack if none was provided', async () => {
        const expectedError = 'Error without a stack!';
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        await bugsplat.post(expectedError, {});

        expect(appendSpy).toHaveBeenCalledWith(
            'callstack',
            jasmine.stringMatching(
                new RegExp(
                    `Error: ${expectedError}.*\n.*at BugSplat\.<anonymous>`
                )
            )
        );
    });

    it('should reconstruct error line of callstack if not provided by browser (Safari)', async () => {
        const error = {
            message: 'Stack without a message',
            stack: 'handlError/<@https://app.bugsplat.com/v2/main-es2015.32bd4307e375ff22d168.js:1:1413880>',
        };
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        await bugsplat.post(error, {});

        expect(appendSpy).toHaveBeenCalledWith(
            'callstack',
            jasmine.stringMatching(
                new RegExp(`Error: ${error.message}.*\n${error.stack}`)
            )
        );
    });

    it('should call fetch url containing database', async () => {
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        await bugsplat.post(new Error('BugSplat!'));

        expect(bugsplat._fetch).toHaveBeenCalledWith(
            `https://${database}.bugsplat.com/post/js/`,
            jasmine.anything()
        );
    });

    it('should call fetch with method and body', async () => {
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        await bugsplat.post(new Error('BugSplat!'));

        expect(bugsplat._fetch).toHaveBeenCalledWith(
            jasmine.anything(),
            jasmine.objectContaining({
                method: 'POST',
                body: fakeFormData,
            })
        );
    });

    it('should return response body and original error if BugSplat POST returns 200', async () => {
        const errorToPost = new Error('BugSplat!');
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        const result = await bugsplat.post(errorToPost, {});

        expect(result.error).toBeFalsy();
        expect(result.response.crash_id).toEqual(expectedCrashId);
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error if BugSplat POST returns an invalid response', async () => {
        const errorToPost = new Error('BugSplat!');
        bugsplat._fetch.and.returnValue({
            status: 200,
            json: async () => ({}),
            ok: true,
        });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual(
            'BugSplat Error: Invalid response received'
        );
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error if BugSplat POST returns 400', async () => {
        const errorToPost = new Error('BugSplat!');
        bugsplat._fetch.and.returnValue({
            status: 400,
            json: async () => ({}),
        });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual('BugSplat Error: Bad request');
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error if BugSplat POST returns 429', async () => {
        const errorToPost = new Error('BugSplat!');
        bugsplat._fetch.and.returnValue({
            status: 429,
            json: async () => ({}),
        });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual(
            'BugSplat Error: Rate limit of one crash per second exceeded'
        );
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error for unknown BugSplat POST error', async () => {
        const errorToPost = new Error('BugSplat!');
        bugsplat._fetch.and.returnValue({
            status: 500,
            json: async () => ({}),
            ok: false,
        });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual('BugSplat Error: Unknown error');
        expect(result.original.message).toEqual(errorToPost.message);
    });

    async function createDefaultPropertyTest(
        bugsplat,
        propertyName,
        propertyValue,
        propertySetter = (value) => {}
    ) {
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        propertySetter(propertyValue);
        await bugsplat.post(new Error('BugSplat!'), {});

        expect(appendSpy).toHaveBeenCalledWith(propertyName, propertyValue);
    }

    async function createOptionsOverrideTest(
        bugsplat,
        postOptions,
        propertyName,
        propertyValue
    ) {
        bugsplat._fetch.and.returnValue(fakeSuccessResponseBody);

        await bugsplat.post(new Error('BugSplat!'), postOptions);

        expect(appendSpy).toHaveBeenCalledWith(propertyName, propertyValue);
    }
});
