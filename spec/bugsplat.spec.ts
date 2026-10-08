import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
    appendAttachment,
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
    const expectedCrashId = 73180;

    let bugsplat: BugSplat;
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
            status: 200,
            json: async () => fakeCrashResponse,
            ok: true,
        };
        bugsplat = new BugSplat(database, appName, appVersion);
        // @ts-expect-error -- accessing private field for test mocking
        bugsplat._formData = () => fakeFormData;
        fetchSpy = vi.fn();
        // @ts-expect-error -- accessing private field for test mocking
        bugsplat._fetch = fetchSpy;
    });

    describe('post', () => {
        it('should use injectable _fetch instead of globalThis.fetch', async () => {
            const customFetch = vi.fn().mockResolvedValue(fakeSuccessResponseBody);
            const globalFetchSpy = vi.fn().mockResolvedValue(fakeSuccessResponseBody);
            vi.stubGlobal('fetch', globalFetchSpy);
            // @ts-expect-error -- accessing private field for test
            bugsplat._fetch = customFetch;

            await bugsplat.post(new Error('BugSplat!'));

            expect(customFetch).toHaveBeenCalledOnce();
            expect(customFetch).toHaveBeenCalledWith(
                `https://${database}.bugsplat.com/post/js/`,
                expect.objectContaining({
                    method: 'POST',
                    body: fakeFormData,
                })
            );
            expect(globalFetchSpy).not.toHaveBeenCalled();
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

        it('should append correct form data fields', async () => {
            const appKey = 'myKey';
            const user = 'myUser';
            const email = 'my@email.com';
            const description = 'myDescription';
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'), {
                appKey,
                user,
                email,
                description,
            });

            expect(appendSpy).toHaveBeenCalledWith('database', database);
            expect(appendSpy).toHaveBeenCalledWith('appName', appName);
            expect(appendSpy).toHaveBeenCalledWith('appVersion', appVersion);
            expect(appendSpy).toHaveBeenCalledWith('callstack', expect.stringContaining('Error:'));
            expect(appendSpy).toHaveBeenCalledWith('appKey', appKey);
            expect(appendSpy).toHaveBeenCalledWith('user', user);
            expect(appendSpy).toHaveBeenCalledWith('email', email);
            expect(appendSpy).toHaveBeenCalledWith('description', description);
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
    });

    describe('beforePost', () => {
        it('should pass the merged report (defaults + options) to the hook', async () => {
            const error = new Error('BugSplat!');
            const attachments = [{ filename: 'a.txt', data: new Blob(['a']) }];
            const hook = vi.fn((report) => report);
            bugsplat.setDefaultAppKey('defaultAppKey');
            bugsplat.setDefaultUser('defaultUser');
            bugsplat.setDefaultEmail('default@email.com');
            bugsplat.setDefaultDescription('defaultDescription');
            bugsplat.setDefaultAttributes({ env: 'production' });
            bugsplat.setBeforePost(hook);
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(error, { user: 'overridenUser', attachments });

            expect(hook).toHaveBeenCalledOnce();
            expect(hook).toHaveBeenCalledWith({
                error,
                callstack: error.stack,
                appKey: 'defaultAppKey',
                user: 'overridenUser',
                email: 'default@email.com',
                description: 'defaultDescription',
                attributes: { env: 'production' },
                attachments,
            });
        });

        it('should post the report returned by the hook', async () => {
            const blob = new Blob(['hooked']);
            bugsplat.setBeforePost((report) => ({
                ...report,
                callstack: report.callstack.replace(/params: .*/g, 'params: [redacted]'),
                description: 'hooked description',
                attributes: { redacted: 'true' },
                attachments: [{ filename: 'hooked.txt', data: blob }],
            }));
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(
                new Error('Failed query: select 1\nparams: ["jane@example.com"]'),
                { description: 'original description' }
            );

            expect(fetchSpy).toHaveBeenCalledOnce();
            expect(appendSpy).toHaveBeenCalledWith(
                'callstack',
                expect.stringContaining('params: [redacted]')
            );
            expect(appendSpy).not.toHaveBeenCalledWith(
                'callstack',
                expect.stringContaining('jane@example.com')
            );
            expect(appendSpy).toHaveBeenCalledWith('description', 'hooked description');
            expect(appendSpy).toHaveBeenCalledWith(
                'attributes',
                JSON.stringify({ redacted: 'true' })
            );
            expect(appendSpy).toHaveBeenCalledWith('hooked.txt', blob, 'hooked.txt');
        });

        it('should post a report mutated in place without touching default attributes', async () => {
            const defaults = { env: 'production' };
            bugsplat.setDefaultAttributes(defaults);
            bugsplat.setBeforePost((report) => {
                report.attributes!.extra = 'x';
                return report;
            });
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'));

            expect(appendSpy).toHaveBeenCalledWith(
                'attributes',
                JSON.stringify({ env: 'production', extra: 'x' })
            );
            expect(defaults).toEqual({ env: 'production' });
        });

        it('should skip fetch and resolve with skipped when the hook returns null', async () => {
            const errorToPost = new Error('BugSplat!');
            bugsplat.setBeforePost(() => null);

            const result = await bugsplat.post(errorToPost);

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(appendSpy).not.toHaveBeenCalled();
            expect(result.skipped).toBe(true);
            expect(result.error?.message).toEqual(
                'BugSplat Error: Report skipped by beforePost hook'
            );
            expect(result.response).toBeNull();
            expect(result.original).toBe(errorToPost);
        });

        it('should treat undefined from the hook as a skip', async () => {
            bugsplat.setBeforePost(() => undefined);

            const result = await bugsplat.post(new Error('BugSplat!'));

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(result.skipped).toBe(true);
        });

        it('should await an async hook', async () => {
            bugsplat.setBeforePost(async (report) => {
                await new Promise((resolve) => setTimeout(resolve, 1));
                return { ...report, description: 'async description' };
            });
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'));

            expect(appendSpy).toHaveBeenCalledWith('description', 'async description');
        });

        it('should skip when an async hook resolves null', async () => {
            bugsplat.setBeforePost(async () => null);

            const result = await bugsplat.post(new Error('BugSplat!'));

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(result.skipped).toBe(true);
        });

        it('should post the original report if the hook throws', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const hookError = new Error('hook bug');
            bugsplat.setBeforePost(() => {
                throw hookError;
            });
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            const result = await bugsplat.post(new Error('BugSplat!'), {
                description: 'original description',
            });

            expect(fetchSpy).toHaveBeenCalledOnce();
            expect(appendSpy).toHaveBeenCalledWith('description', 'original description');
            expect(result.error).toBeNull();
            expect(result.skipped).toBeUndefined();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('beforePost'),
                hookError
            );
            consoleErrorSpy.mockRestore();
        });

        it('should post the original report if an async hook rejects', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            bugsplat.setBeforePost(async () => {
                throw new Error('async hook bug');
            });
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            const result = await bugsplat.post(new Error('BugSplat!'));

            expect(fetchSpy).toHaveBeenCalledOnce();
            expect(result.error).toBeNull();
            consoleErrorSpy.mockRestore();
        });

        it('should clear the hook when setBeforePost is called with null', async () => {
            const hook = vi.fn(() => null);
            bugsplat.setBeforePost(hook);
            bugsplat.setBeforePost(null);
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            const result = await bugsplat.post(new Error('BugSplat!'));

            expect(hook).not.toHaveBeenCalled();
            expect(fetchSpy).toHaveBeenCalledOnce();
            expect(result.error).toBeNull();
            expect(result.skipped).toBeUndefined();
        });
    });

    describe('postFeedback', () => {
        it('should POST to /api/post/feedback', async () => {
            fetchSpy.mockClear();
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
            await bugsplat.postFeedback('My feedback');

            const url = fetchSpy.mock.calls[0][0];
            expect(url).toEqual(`https://${database}.bugsplat.com/post/feedback/`);
            expect(fetchSpy.mock.calls[0][1].method).toEqual('POST');
        });

        it('should append title to form data', async () => {
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
            await bugsplat.postFeedback('My feedback');

            expect(appendSpy).toHaveBeenCalledWith('title', 'My feedback');
        });
    });

    describe('when options.attributes is set', () => {
        it('should append JSON-serialized attributes', async () => {
            const attributes = { foo: 'bar', baz: 'qux' };
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'), { attributes });

            expect(appendSpy).toHaveBeenCalledWith(
                'attributes',
                JSON.stringify(attributes)
            );
        });

        it('should not append attributes if empty object', async () => {
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
            await bugsplat.post(new Error('BugSplat!'), { attributes: {} });

            expect(appendSpy).not.toHaveBeenCalledWith(
                'attributes',
                expect.anything()
            );
        });

        it('should use default attributes if options.attributes is not set', async () => {
            const attributes = { env: 'production' };
            bugsplat.setDefaultAttributes(attributes);
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'), {});

            expect(appendSpy).toHaveBeenCalledWith(
                'attributes',
                JSON.stringify(attributes)
            );
        });

        it('should use options.attributes over default attributes', async () => {
            const defaultAttributes = { env: 'production' };
            const overrideAttributes = { env: 'staging' };
            bugsplat.setDefaultAttributes(defaultAttributes);
            fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

            await bugsplat.post(new Error('BugSplat!'), {
                attributes: overrideAttributes,
            });

            expect(appendSpy).toHaveBeenCalledWith(
                'attributes',
                JSON.stringify(overrideAttributes)
            );
        });
    });

    it('should use default appKey if options.appKey is not set', async () => {
        bugsplat.setDefaultAppKey('defaultAppKey');
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('appKey', 'defaultAppKey');
    });

    it('should use options.appKey if set', async () => {
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), { appKey: 'overridenAppKey' });
        expect(appendSpy).toHaveBeenCalledWith('appKey', 'overridenAppKey');
    });

    it('should use default user if options.user is not set', async () => {
        bugsplat.setDefaultUser('defaultUser');
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('user', 'defaultUser');
    });

    it('should use options.user if set', async () => {
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), { user: 'overridenUser' });
        expect(appendSpy).toHaveBeenCalledWith('user', 'overridenUser');
    });

    it('should use default email if options.email is not set', async () => {
        bugsplat.setDefaultEmail('defaultEmail');
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('email', 'defaultEmail');
    });

    it('should use options.email if set', async () => {
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), { email: 'overridenEmail' });
        expect(appendSpy).toHaveBeenCalledWith('email', 'overridenEmail');
    });

    it('should use default description if options.description is not set', async () => {
        bugsplat.setDefaultDescription('defaultDescription');
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('description', 'defaultDescription');
    });

    it('should use options.description if set', async () => {
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);
        await bugsplat.post(new Error('BugSplat!'), { description: 'overridenDescription' });
        expect(appendSpy).toHaveBeenCalledWith('description', 'overridenDescription');
    });

    it('should return response body and original error on success', async () => {
        const errorToPost = new Error('BugSplat!');
        fetchSpy.mockResolvedValue(fakeSuccessResponseBody);

        const result = await bugsplat.post(errorToPost, {});

        expect(result.error).toBeNull();
        if (!result.error) {
            expect(result.response.crash_id).toEqual(expectedCrashId);
        }
        expect(result.original).toBe(errorToPost);
    });

    it('should return error if post returns 400', async () => {
        fetchSpy.mockResolvedValue({
            status: 400,
            json: async () => ({}),
        });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual('BugSplat Error: Bad request');
    });

    it('should return error if post returns 429', async () => {
        fetchSpy.mockResolvedValue({
            status: 429,
            json: async () => ({}),
        });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual(
            'BugSplat Error: Rate limit of one crash per second exceeded'
        );
    });

    it('should return error for unknown error', async () => {
        fetchSpy.mockResolvedValue({
            status: 500,
            json: async () => ({}),
            ok: false,
        });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual('BugSplat Error: Unknown error');
    });

    it('should return error if response is invalid', async () => {
        fetchSpy.mockResolvedValue({
            status: 200,
            json: async () => ({}),
            ok: true,
        });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual('BugSplat Error: Invalid response received');
    });
});

describe('appendAttachment', () => {
    let append: Mock;
    let body: FormData;

    beforeEach(() => {
        append = vi.fn();
        body = { append } as unknown as FormData;
    });

    it('wraps a Uint8Array in a Blob before appending', () => {
        const bytes = new Uint8Array([0x42, 0x53]);
        appendAttachment(body, { filename: 'data.bin', data: bytes });
        expect(append).toHaveBeenCalledTimes(1);
        const [filename, value, postedName] = append.mock.calls[0];
        expect(filename).toBe('data.bin');
        expect(value).toBeInstanceOf(Blob);
        expect(postedName).toBe('data.bin');
    });

    it('uploads only the bytes covered by a Uint8Array view, not the whole backing buffer', async () => {
        // Build a Uint8Array that is a subarray view into a larger buffer.
        const underlying = new Uint8Array([0x00, 0x00, 0x42, 0x53, 0x00, 0x00]);
        const view = underlying.subarray(2, 4); // just [0x42, 0x53]
        appendAttachment(body, { filename: 'data.bin', data: view });
        const [, value] = append.mock.calls[0];
        expect(value).toBeInstanceOf(Blob);
        expect((value as Blob).size).toBe(2);
        const bytes = new Uint8Array(await (value as Blob).arrayBuffer());
        expect(Array.from(bytes)).toEqual([0x42, 0x53]);
    });

    it('passes a Blob through with filename', () => {
        const blob = new Blob(['hello']);
        appendAttachment(body, { filename: 'hello.txt', data: blob });
        expect(append).toHaveBeenCalledWith('hello.txt', blob, 'hello.txt');
    });

    it('appends a React Native file ref in {uri, name, type} shape', () => {
        appendAttachment(body, {
            filename: 'screenshot.png',
            data: { uri: 'file:///tmp/shot.png', type: 'image/png' },
        });
        expect(append).toHaveBeenCalledWith(
            'screenshot.png',
            { uri: 'file:///tmp/shot.png', type: 'image/png', name: 'screenshot.png' },
            'screenshot.png'
        );
    });

    it('handles a file ref with no type', () => {
        appendAttachment(body, {
            filename: 'log.txt',
            data: { uri: 'file:///tmp/log.txt' },
        });
        expect(append).toHaveBeenCalledWith(
            'log.txt',
            { uri: 'file:///tmp/log.txt', type: undefined, name: 'log.txt' },
            'log.txt'
        );
    });
});
