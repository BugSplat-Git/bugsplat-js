import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
    BugSplat,
    createStandardizedCallStack,
    tryParseResponseJson,
} from '../src/bugsplat';
import { Blob } from 'buffer';

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
        const inputs = values.map(async () => {
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
    let appendSpy: Mock;
    let fakeFormData;
    let fakeCrashResponse;
    let fakeSuccessResponseBody;
    let fetchSpy: Mock;

    beforeEach(() => {
        appendSpy = vi.fn();
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
        bugsplat._formData = () => fakeFormData;
        fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as Mock;
    });

    describe('when options.additionalFormDataParams is set', () => {
        it('should call append with key and value if passed string value', async () => {
            const key = 'attachment.txt';
            const value = '🐶';
            const additionalFormDataParams = [{ key, value }];
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'), {
                additionalFormDataParams,
            });

            expect(appendSpy).toHaveBeenCalledWith(key, value);
        });

        it('should call append with key, value and filename if passed Blob value', async () => {
            const key = 'attachment.txt';
            const value = new Blob([]);
            const filename = key;
            const additionalFormDataParams = [{ key, value, filename }];
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'), {
                additionalFormDataParams,
            });

            expect(appendSpy).toHaveBeenCalledWith(key, value, filename);
        });
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
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        await bugsplat.post(expectedError, {});

        expect(appendSpy).toHaveBeenCalledWith(
            'callstack',
            expectedError.stack
        );
    });

    it('should create a stack if none was provided', async () => {
        const expectedError = 'Error without a stack!';
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        await bugsplat.post(expectedError, {});

        expect(appendSpy).toHaveBeenCalledWith(
            'callstack',
            expect.stringMatching(
                new RegExp(
                    `Error: ${expectedError}.*\n.*at BugSplat\\.`
                )
            )
        );
    });

    it('should create a stack if stack is only spaces', async () => {
        const expectedError = '      ';
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        await bugsplat.post(expectedError, {});

        expect(appendSpy).toHaveBeenCalledWith(
            'callstack',
            expect.stringMatching(
                new RegExp(
                    `Error: ${expectedError}.*\n.*at BugSplat\\.`
                )
            )
        );
    });

    it('should reconstruct error line of callstack if not provided by browser (Safari)', async () => {
        const error = {
            message: 'Stack without a message',
            stack: 'handlError/<@https://app.bugsplat.com/v2/main-es2015.32bd4307e375ff22d168.js:1:1413880>',
        };
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        await bugsplat.post(error, {});

        expect(appendSpy).toHaveBeenCalledWith(
            'callstack',
            expect.stringMatching(
                new RegExp(`Error: ${error.message}.*\n${error.stack}`)
            )
        );
    });

    it('should call fetch url containing database', async () => {
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        await bugsplat.post(new Error('BugSplat!'));

        expect(fetchSpy).toHaveBeenCalledWith(
            `https://${database}.bugsplat.com/post/js/`,
            expect.anything()
        );
    });

    it('should call fetch with method and body', async () => {
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        await bugsplat.post(new Error('BugSplat!'));

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                method: 'POST',
                body: fakeFormData,
            })
        );
    });

    it('should return response body and original error if BugSplat POST returns 200', async () => {
        const errorToPost = new Error('BugSplat!');
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        const result = await bugsplat.post(errorToPost, {});

        expect(result.error).toBeFalsy();
        expect(result.response.crash_id).toEqual(expectedCrashId);
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error if BugSplat POST returns an invalid response', async () => {
        const errorToPost = new Error('BugSplat!');
        fetchSpy.mockResolvedValue({
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
        fetchSpy.mockResolvedValue({
            status: 400,
            json: async () => ({}),
        });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual('BugSplat Error: Bad request');
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error if BugSplat POST returns 429', async () => {
        const errorToPost = new Error('BugSplat!');
        fetchSpy.mockResolvedValue({
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
        fetchSpy.mockResolvedValue({
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
        propertySetter = (_value) => {
            // no-op
        }
    ) {
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

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
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        await bugsplat.post(new Error('BugSplat!'), postOptions);

        expect(appendSpy).toHaveBeenCalledWith(propertyName, propertyValue);
    }
});
