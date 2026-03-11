import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
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
    let fetchSpy: Mock;

    const fakePresignedUrlResponse = {
        ok: true,
        json: async () => ({ url: 'https://s3.example.com/presigned' }),
    };

    const fakePutResponse = {
        ok: true,
        headers: { get: (key: string) => key === 'ETag' ? '"abc123"' : null },
    };

    const fakeCommitResponse = {
        ok: true,
        status: 200,
        json: async () => ({
            status: 'success',
            crashId: expectedCrashId,
            stackKeyId: 1,
            messageId: 1,
            infoUrl: 'https://app.bugsplat.com/browse/crashInfo.php',
        }),
    };

    beforeEach(() => {
        appendSpy = vi.fn();
        fakeFormData = { append: appendSpy, toString: () => 'BugSplat rocks!' };
        bugsplat = new BugSplat(database, appName, appVersion);
        // @ts-expect-error -- accessing private field for test mocking
        bugsplat._formData = () => fakeFormData;
        fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as Mock;
        fetchSpy
            .mockResolvedValueOnce(fakePresignedUrlResponse)
            .mockResolvedValueOnce(fakePutResponse)
            .mockResolvedValueOnce(fakeCommitResponse);
    });

    describe('presigned URL upload flow', () => {
        it('should request a presigned URL with correct query params', async () => {
            await bugsplat.post(new Error('BugSplat!'));

            const url = new URL(fetchSpy.mock.calls[0][0]);
            expect(url.pathname).toEqual('/api/getCrashUploadUrl');
            expect(url.searchParams.get('database')).toEqual(database);
            expect(url.searchParams.get('appName')).toEqual(appName);
            expect(url.searchParams.get('appVersion')).toEqual(appVersion);
        });

        it('should PUT to the presigned URL', async () => {
            await bugsplat.post(new Error('BugSplat!'));

            expect(fetchSpy.mock.calls[1][0]).toEqual('https://s3.example.com/presigned');
            expect(fetchSpy.mock.calls[1][1].method).toEqual('PUT');
        });

        it('should commit with correct form data fields', async () => {
            const appKey = 'myKey';
            const user = 'myUser';
            const email = 'my@email.com';
            const description = 'myDescription';

            await bugsplat.post(new Error('BugSplat!'), {
                appKey,
                user,
                email,
                description,
            });

            expect(appendSpy).toHaveBeenCalledWith('database', database);
            expect(appendSpy).toHaveBeenCalledWith('appName', appName);
            expect(appendSpy).toHaveBeenCalledWith('appVersion', appVersion);
            expect(appendSpy).toHaveBeenCalledWith('crashTypeId', '14');
            expect(appendSpy).toHaveBeenCalledWith('s3Key', 'https://s3.example.com/presigned');
            expect(appendSpy).toHaveBeenCalledWith('md5', 'abc123');
            expect(appendSpy).toHaveBeenCalledWith('appKey', appKey);
            expect(appendSpy).toHaveBeenCalledWith('user', user);
            expect(appendSpy).toHaveBeenCalledWith('email', email);
            expect(appendSpy).toHaveBeenCalledWith('description', description);
        });

        it('should commit with crashTypeId 36 for feedback', async () => {
            await bugsplat.postFeedback('My feedback');

            expect(appendSpy).toHaveBeenCalledWith('crashTypeId', '36');
        });
    });

    describe('when options.attributes is set', () => {
        it('should append JSON-serialized attributes to commit body', async () => {
            const attributes = { foo: 'bar', baz: 'qux' };

            await bugsplat.post(new Error('BugSplat!'), { attributes });

            expect(appendSpy).toHaveBeenCalledWith(
                'attributes',
                JSON.stringify(attributes)
            );
        });

        it('should not append attributes if empty object', async () => {
            await bugsplat.post(new Error('BugSplat!'), { attributes: {} });

            expect(appendSpy).not.toHaveBeenCalledWith(
                'attributes',
                expect.anything()
            );
        });

        it('should use default attributes if options.attributes is not set', async () => {
            const attributes = { env: 'production' };
            bugsplat.setDefaultAttributes(attributes);

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
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('appKey', 'defaultAppKey');
    });

    it('should use options.appKey if set', async () => {
        await bugsplat.post(new Error('BugSplat!'), { appKey: 'overridenAppKey' });
        expect(appendSpy).toHaveBeenCalledWith('appKey', 'overridenAppKey');
    });

    it('should use default user if options.user is not set', async () => {
        bugsplat.setDefaultUser('defaultUser');
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('user', 'defaultUser');
    });

    it('should use options.user if set', async () => {
        await bugsplat.post(new Error('BugSplat!'), { user: 'overridenUser' });
        expect(appendSpy).toHaveBeenCalledWith('user', 'overridenUser');
    });

    it('should use default email if options.email is not set', async () => {
        bugsplat.setDefaultEmail('defaultEmail');
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('email', 'defaultEmail');
    });

    it('should use options.email if set', async () => {
        await bugsplat.post(new Error('BugSplat!'), { email: 'overridenEmail' });
        expect(appendSpy).toHaveBeenCalledWith('email', 'overridenEmail');
    });

    it('should use default description if options.description is not set', async () => {
        bugsplat.setDefaultDescription('defaultDescription');
        await bugsplat.post(new Error('BugSplat!'), {});
        expect(appendSpy).toHaveBeenCalledWith('description', 'defaultDescription');
    });

    it('should use options.description if set', async () => {
        await bugsplat.post(new Error('BugSplat!'), { description: 'overridenDescription' });
        expect(appendSpy).toHaveBeenCalledWith('description', 'overridenDescription');
    });

    it('should return response body and original error on success', async () => {
        const errorToPost = new Error('BugSplat!');

        const result = await bugsplat.post(errorToPost, {});

        expect(result.error).toBeNull();
        if (!result.error) {
            expect(result.response.crashId).toEqual(expectedCrashId);
        }
        expect(result.original).toBe(errorToPost);
    });

    it('should return error if presigned URL request fails', async () => {
        fetchSpy.mockReset();
        fetchSpy.mockResolvedValueOnce({ ok: false });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual('BugSplat Error: Failed to get upload URL');
    });

    it('should return error if S3 upload fails', async () => {
        fetchSpy.mockReset();
        fetchSpy
            .mockResolvedValueOnce(fakePresignedUrlResponse)
            .mockResolvedValueOnce({ ok: false });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual('BugSplat Error: Failed to upload to S3');
    });

    it('should return error if commit fails', async () => {
        fetchSpy.mockReset();
        fetchSpy
            .mockResolvedValueOnce(fakePresignedUrlResponse)
            .mockResolvedValueOnce(fakePutResponse)
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({}),
            });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual('BugSplat Error: Failed to commit upload');
    });

    it('should return error if commit response is invalid', async () => {
        fetchSpy.mockReset();
        fetchSpy
            .mockResolvedValueOnce(fakePresignedUrlResponse)
            .mockResolvedValueOnce(fakePutResponse)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
            });

        const result = await bugsplat.post(new Error('BugSplat!'), {});

        expect(result.error).not.toBeNull();
        expect(result.error!.message).toEqual('BugSplat Error: Invalid response received');
    });
});
