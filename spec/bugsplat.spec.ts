import { BugSplat } from '../src/bugsplat';

describe('BugSplat', function () {

    const database = 'fred';
    const appName = 'my-node-crasher';
    const appVersion = '1.0.0.0';
    const expectedStatus = 'success';
    const expectedCrashId = 73180;
    
    let bugsplat;
    let appendSpy;
    let fakeFormData;
    let fakeSuccessReponseBody;

    beforeEach(() => {
        appendSpy = jasmine.createSpy();
        fakeFormData = { append: appendSpy, toString: () => 'BugSplat rocks!' };
        fakeSuccessReponseBody = { status: expectedStatus, json: async() => ({crash_id: expectedCrashId}), ok: true }
        bugsplat = new BugSplat(database, appName, appVersion);
        bugsplat._fetch = jasmine.createSpy();
        bugsplat._formData = () => fakeFormData;
    });

    it('should call append with options.additionalFormDataParams if set', async () => {
        const key = 'attachment.txt';
        const value = '🐶';
        const additionalFormDataParams = [{key, value}];
        bugsplat._fetch.and.returnValue(fakeSuccessReponseBody);

        await bugsplat.post(new Error('BugSplat!'), { additionalFormDataParams });

        expect(appendSpy).toHaveBeenCalledWith(key, value);
    });

    it('should use default appKey if options.appKey is not set', async () => {
        await createDefaultPropertyTest(bugsplat, 'appKey', 'defaultAppKey', bugsplat.setDefaultAppKey.bind(bugsplat));
    });

    it('should use options.appKey if set', async () => {
        const appKey = 'overridenAppKey';
        await createOptionsOverrideTest(bugsplat, { appKey }, 'appKey', appKey);
    });

    it('should use default user if options.user is not set', async () => {
        await createDefaultPropertyTest(bugsplat, 'user', 'defaultUser', bugsplat.setDefaultUser.bind(bugsplat));
    });

    it('should use options.user if set', async () => {
        const user = 'overridenUser';
        await createOptionsOverrideTest(bugsplat, { user }, 'user', user);
    });

    it('should use default email if options.email is not set', async () => {
        await createDefaultPropertyTest(bugsplat, 'email', 'defaultEmail', bugsplat.setDefaultEmail.bind(bugsplat));
    });

    it('should use options.email if set', async () => {
        const email = 'overridenEmail';
        await createOptionsOverrideTest(bugsplat, { email }, 'email', email);
    });

    it('should use default description if options.description is not set', async () => {
        await createDefaultPropertyTest(bugsplat, 'description', 'defaultDescription', bugsplat.setDefaultDescription.bind(bugsplat));
    });

    it('should use options.description if set', async () => {
        const description = 'overridenDescription';
        await createOptionsOverrideTest(bugsplat, { description }, 'description', description);
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
        bugsplat._fetch.and.returnValue(fakeSuccessReponseBody);

        await bugsplat.post(expectedError, {});

        expect(appendSpy).toHaveBeenCalledWith('callstack', expectedError.stack);
    });

    it('should call fetch url containing database', async () => {
        bugsplat._fetch.and.returnValue(fakeSuccessReponseBody);

        await bugsplat.post(new Error('BugSplat!'));

        expect(bugsplat._fetch).toHaveBeenCalledWith(`https://${database}.bugsplat.com/post/js/`, jasmine.anything());
    });

    it('should call fetch with method and body', async () => {
        bugsplat._fetch.and.returnValue(fakeSuccessReponseBody);

        await bugsplat.post(new Error('BugSplat!'));

        expect(bugsplat._fetch).toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({
            method: 'POST',
            body: fakeFormData
        }));
    });

    it('should return response body and original error if BugSplat POST returns 200', async () => {
        const errorToPost = new Error('BugSplat!')
        bugsplat._fetch.and.returnValue(fakeSuccessReponseBody);

        const result = await bugsplat.post(errorToPost, {});

        expect(result.error).toBeFalsy();
        expect(result.response.crash_id).toEqual(expectedCrashId);
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error if BugSplat POST returns 400', async () => {
        const errorToPost = new Error('BugSplat!')
        bugsplat._fetch.and.returnValue({ status: 400, json: async () => ({}) });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual('BugSplat Error: Bad request');
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error if BugSplat POST returns 429', async () => {
        const errorToPost = new Error('BugSplat!')
        bugsplat._fetch.and.returnValue({ status: 429, json: async () => ({}) });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual('BugSplat Error: Rate limit of one crash per second exceeded');
        expect(result.original.message).toEqual(errorToPost.message);
    });

    it('should return BugSplat error, response body and original error for unknown BugSplat POST error', async () => {
        const errorToPost = new Error('BugSplat!')
        bugsplat._fetch.and.returnValue({ status: 500, json: async () => ({}), ok: false });

        const result = await bugsplat.post(errorToPost, {});
        expect(result.error.message).toEqual('BugSplat Error: Unknown error');
        expect(result.original.message).toEqual(errorToPost.message);
    });

    async function createDefaultPropertyTest(bugsplat, propertyName, propertyValue, propertySetter = (value) => {}) {
        bugsplat._fetch.and.returnValue(fakeSuccessReponseBody);

        propertySetter(propertyValue);
        await bugsplat.post(new Error('BugSplat!'), {});

        expect(appendSpy).toHaveBeenCalledWith(propertyName, propertyValue);
    }

    async function createOptionsOverrideTest(bugsplat, postOptions, propertyName, propertyValue) {     
        bugsplat._fetch.and.returnValue(fakeSuccessReponseBody);

        await bugsplat.post(new Error('BugSplat!'), postOptions);

        expect(appendSpy).toHaveBeenCalledWith(propertyName, propertyValue);
    }
});