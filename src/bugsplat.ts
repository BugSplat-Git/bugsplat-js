import { zipSync, strToU8 } from 'fflate';
import type { BugSplatOptions } from './bugsplat-options';
import {
    type BugSplatResponse,
    type BugSplatResponseBody,
    type BugSplatResponseType,
    validateResponseBody,
} from './bugsplat-response';

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
 * BugSplat crash and feedback posting client.
 */
export class BugSplat {
    private _formData = () => new FormData();

    private _appKey = '';
    private _attributes: Record<string, string> = {};
    private _description = '';
    private _email = '';
    private _user = '';

    constructor(
        public readonly database: string,
        public readonly application: string,
        public readonly version: string
    ) {}

    /**
     * Posts an arbitrary Error object to BugSplat via presigned URL upload
     * @param errorToPost - Error object or a message to be sent to BugSplat
     * @param options - Additional parameters that can be sent to BugSplat
     */
    async post(
        errorToPost: Error | string,
        options?: BugSplatOptions
    ): Promise<BugSplatResponse> {
        options = options || {};

        const callstack = createStandardizedCallStack(
            isError(errorToPost) ? errorToPost : new Error(errorToPost)
        );

        const zipFiles: Record<string, Uint8Array> = {
            'javascriptCallStack.txt': strToU8(callstack),
        };
        for (const attachment of options.attachments || []) {
            const bytes = attachment.data instanceof Uint8Array
                ? attachment.data
                : new Uint8Array(await attachment.data.arrayBuffer());
            zipFiles[attachment.filename] = bytes;
        }

        console.log('BugSplat Error:', errorToPost);

        return this._upload(zipFiles, '14', options, errorToPost);
    }

    /**
     * Posts user feedback to BugSplat via presigned URL upload
     * @param title - Feedback title, used as the stack key for grouping
     * @param options - Additional parameters for the feedback submission
     */
    async postFeedback(
        title: string,
        options?: BugSplatOptions
    ): Promise<BugSplatResponse> {
        options = options || {};

        const description = options.description || this._description;

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

        console.log('BugSplat Feedback:', title);

        return this._upload(zipFiles, '36', options, title);
    }

    /**
     * Additional metadata that can be queried via BugSplat's web application
     */
    setDefaultAppKey(appKey: string): void {
        this._appKey = appKey;
    }

    /**
     * Key/value attributes to attach to crash and feedback reports.
     * These are searchable via BugSplat's web application.
     */
    setDefaultAttributes(attributes: Record<string, string>): void {
        this._attributes = attributes;
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

    /**
     * Shared presigned URL upload flow used by both post() and postFeedback().
     */
    private async _upload(
        zipFiles: Record<string, Uint8Array>,
        crashTypeId: string,
        options: BugSplatOptions,
        original: Error | string
    ): Promise<BugSplatResponse> {
        const appKey = options.appKey || this._appKey;
        const attributes = options.attributes || this._attributes;
        const user = options.user || this._user;
        const email = options.email || this._email;
        const description = options.description || this._description;

        const zipData = zipSync(zipFiles);
        const baseUrl = process.env.BUGSPLAT_BASE_URL || `https://${this.database}.bugsplat.com`;

        // Step 1: Get presigned upload URL
        const getCrashUrlParams = new URLSearchParams({
            database: this.database,
            appName: this.application,
            appVersion: this.version,
            crashPostSize: String(zipData.byteLength),
        });

        console.log('BugSplat: Getting presigned URL...');

        const getCrashUrlResponse = await globalThis.fetch(
            `${baseUrl}/api/getCrashUploadUrl?${getCrashUrlParams}`
        );

        if (!getCrashUrlResponse.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Failed to get upload URL'),
                {},
                original
            );
        }

        const { url: presignedUrl } = await getCrashUrlResponse.json() as { url: string };

        // Step 2: Upload zip to S3
        console.log('BugSplat: Uploading...');

        const putResponse = await globalThis.fetch(presignedUrl, {
            method: 'PUT',
            body: new Blob([zipData.buffer as ArrayBuffer], { type: 'application/zip' }),
            headers: { 'Content-Type': 'application/zip' },
        });

        if (!putResponse.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Failed to upload to S3'),
                {},
                original
            );
        }

        const etag = putResponse.headers.get('ETag')?.replace(/"/g, '') || '';

        // Step 3: Commit the upload
        console.log('BugSplat: Committing...');

        const commitBody = this._formData();
        commitBody.append('database', this.database);
        commitBody.append('appName', this.application);
        commitBody.append('appVersion', this.version);
        commitBody.append('crashTypeId', crashTypeId);
        commitBody.append('s3Key', presignedUrl);
        commitBody.append('md5', etag);
        commitBody.append('appKey', appKey);
        commitBody.append('user', user);
        commitBody.append('email', email);
        commitBody.append('description', description);
        if (Object.keys(attributes).length > 0) {
            commitBody.append('attributes', JSON.stringify(attributes));
        }

        const commitResponse = await globalThis.fetch(
            `${baseUrl}/api/commitS3CrashUpload`,
            { method: 'POST', body: commitBody }
        );

        const json = await tryParseResponseJson(commitResponse);

        console.log('BugSplat commit status code:', commitResponse.status);
        console.log('BugSplat commit response body:', json);

        if (!commitResponse.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Failed to commit upload'),
                json,
                original
            );
        }

        if (!validateResponseBody(json)) {
            return this._createReturnValue(
                new Error('BugSplat Error: Invalid response received'),
                json,
                original
            );
        }

        return this._createReturnValue(null, json, original);
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
