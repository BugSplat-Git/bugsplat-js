import { zipSync, strToU8 } from 'fflate';
import type { BugSplatFeedbackOptions, BugSplatOptions } from './bugsplat-options';
import {
    type BugSplatResponse,
    type BugSplatResponseBody,
    type BugSplatResponseType,
    validateResponseBody,
} from './bugsplat-response';
import { isFormDataParamString } from './form-data-param';

export function createStandardizedCallStack(error: Error): string {
    if (!error.stack?.includes('Error:')) {
        return `Error: ${error.message}\n${error.stack}`;
    }

    return error.stack;
}

/**
 * Attempt to parse a response body as json
 * @returns parsed body or an empty object if an error occurred while parsing
 */
export async function tryParseResponseJson(response: {
    json(): Promise<unknown>;
}): Promise<unknown> {
    let parsed: unknown;
    try {
        parsed = await response.json();
    } catch {
        parsed = {};
    }
    return parsed;
}

const isError = (val: unknown): val is Error => Boolean((val as Error)?.stack);

/**
 * BugSplat crash posting client. Facilitates sending
 * crash reports through the `post()` method.
 */
export class BugSplat {
    private _formData = () => new FormData();

    private _appKey = '';
    private _description = '';
    private _email = '';
    private _user = '';

    constructor(
        public readonly database: string,
        public readonly application: string,
        public readonly version: string
    ) {}

    /**
     * Posts an arbitrary Error object to BugSplat
     * @param errorToPost - Error object or a message to be sent to BugSplat
     * @param options - Additional parameters that can be sent to BugSplat
     */
    async post(
        errorToPost: Error | string,
        options?: BugSplatOptions
    ): Promise<BugSplatResponse> {
        options = options || {};

        const appKey = options.appKey || this._appKey;
        const user = options.user || this._user;
        const email = options.email || this._email;
        const description = options.description || this._description;
        const additionalFormDataParams = options.additionalFormDataParams || [];
        const callstack = createStandardizedCallStack(
            isError(errorToPost) ? errorToPost : new Error(errorToPost)
        );

        const url = process.env.BUGSPLAT_CRASH_POST_URL || 'https://' + this.database + '.bugsplat.com/post/js/';
        const method = 'POST';
        const body = this._formData();
        body.append('database', this.database);
        body.append('appName', this.application);
        body.append('appVersion', this.version);
        body.append('appKey', appKey);
        body.append('user', user);
        body.append('email', email);
        body.append('description', description);
        body.append('callstack', callstack);
        additionalFormDataParams.forEach((param) => {
            if (isFormDataParamString(param)) {
                body.append(param.key, param.value);
            } else {
                body.append(param.key, param.value, param.filename);
            }
        });

        console.log('BugSplat Error:', errorToPost);
        console.log('BugSplat Url:', url);

        const response = await globalThis.fetch(url, { method, body });
        const json = await tryParseResponseJson(response);

        console.log('BugSplat POST status code:', response.status);
        console.log('BugSplat POST response body:', json);

        if (response.status === 400) {
            return this._createReturnValue(
                new Error('BugSplat Error: Bad request'),
                json,
                errorToPost
            );
        }

        if (response.status === 429) {
            return this._createReturnValue(
                new Error(
                    'BugSplat Error: Rate limit of one crash per second exceeded'
                ),
                json,
                errorToPost
            );
        }

        if (!response.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Unknown error'),
                json,
                errorToPost
            );
        }

        if (!validateResponseBody(json)) {
            return this._createReturnValue(
                new Error('BugSplat Error: Invalid response received'),
                json,
                errorToPost
            );
        }

        return this._createReturnValue(null, json, errorToPost);
    }

    /**
     * Posts user feedback to BugSplat via the presigned URL upload flow
     * @param title - Feedback title, used as the stack key for grouping
     * @param options - Additional parameters for the feedback submission
     */
    async postFeedback(
        title: string,
        options?: BugSplatFeedbackOptions
    ): Promise<BugSplatResponse> {
        options = options || {};

        const appKey = options.appKey || this._appKey;
        const user = options.user || this._user;
        const email = options.email || this._email;
        const description = options.description || this._description;

        // Create zip with feedback.json and any attachments
        const feedbackJson = JSON.stringify({ title, description });
        const zipFiles: Record<string, Uint8Array> = {
            'feedback.json': strToU8(feedbackJson),
        };
        for (const attachment of options.attachments || []) {
            const bytes = attachment.data instanceof Uint8Array
                ? attachment.data
                : new Uint8Array(await attachment.data.arrayBuffer());
            zipFiles[attachment.filename] = bytes;
        }
        const zipData = zipSync(zipFiles);

        const baseUrl = process.env.BUGSPLAT_CRASH_POST_URL?.replace(/\/post\/js\/?$/, '') || `https://${this.database}.bugsplat.com`;

        // Step 1: Get presigned upload URL
        const getCrashUrlParams = new URLSearchParams({
            database: this.database,
            appName: this.application,
            appVersion: this.version,
            crashPostSize: String(zipData.byteLength)
        });

        console.log('BugSplat Feedback:', title);
        console.log('BugSplat: Getting presigned URL...');

        const getCrashUrlResponse = await globalThis.fetch(
            `${baseUrl}/api/getCrashUploadUrl?${getCrashUrlParams}`
        );

        if (!getCrashUrlResponse.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Failed to get upload URL'),
                {},
                title
            );
        }

        const { url: presignedUrl } = await getCrashUrlResponse.json() as { url: string };

        // Step 2: Upload zip to S3
        console.log('BugSplat: Uploading feedback...');

        const putResponse = await globalThis.fetch(presignedUrl, {
            method: 'PUT',
            body: new Blob([zipData.buffer as ArrayBuffer], { type: 'application/zip' }),
            headers: { 'Content-Type': 'application/zip' }
        });

        if (!putResponse.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Failed to upload to S3'),
                {},
                title
            );
        }

        const etag = putResponse.headers.get('ETag')?.replace(/"/g, '') || '';

        // Step 3: Commit the upload
        console.log('BugSplat: Committing feedback...');

        const commitBody = this._formData();
        commitBody.append('database', this.database);
        commitBody.append('appName', this.application);
        commitBody.append('appVersion', this.version);
        commitBody.append('crashTypeId', '36');
        commitBody.append('s3Key', presignedUrl);
        commitBody.append('md5', etag);
        commitBody.append('appKey', appKey);
        commitBody.append('user', user);
        commitBody.append('email', email);
        commitBody.append('description', description);

        const additionalFormDataParams = options.additionalFormDataParams || [];
        additionalFormDataParams.forEach((param) => {
            if (isFormDataParamString(param)) {
                commitBody.append(param.key, param.value);
            } else {
                commitBody.append(param.key, param.value, param.filename);
            }
        });

        const commitResponse = await globalThis.fetch(
            `${baseUrl}/api/commitS3CrashUpload`,
            { method: 'POST', body: commitBody }
        );

        const json = await tryParseResponseJson(commitResponse);

        console.log('BugSplat commit status code:', commitResponse.status);
        console.log('BugSplat commit response body:', json);

        if (!commitResponse.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Failed to commit feedback'),
                json,
                title
            );
        }

        if (!validateResponseBody(json)) {
            return this._createReturnValue(
                new Error('BugSplat Error: Invalid response received'),
                json,
                title
            );
        }

        return this._createReturnValue(null, json, title);
    }

    /**
     * Additional metadata that can be queried via BugSplat's web application
     */
    setDefaultAppKey(appKey: string): void {
        this._appKey = appKey;
    }

    /**
     * Additional info about your crash that gets reset after every post
     */
    setDefaultDescription(description: string): void {
        this._description = description;
    }

    /**
     * The email of your user
     */
    setDefaultEmail(email: string): void {
        this._email = email;
    }

    /**
     * The name or id of your user
     */
    setDefaultUser(user: string): void {
        this._user = user;
    }

    private _createReturnValue<ErrorType extends Error | null>(
        error: ErrorType,
        response: ErrorType extends null ? BugSplatResponseBody : unknown,
        original: Error | string
    ): BugSplatResponseType<ErrorType> {
        return {
            error,
            response,
            original,
        };
    }
}
