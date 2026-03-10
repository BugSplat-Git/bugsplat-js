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
 * Creates a minimal ZIP file containing a single file.
 * Implements the bare minimum of the ZIP format specification.
 */
function createZip(filename: string, data: Uint8Array): Uint8Array {
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(filename);
    const crc = crc32(data);
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lhView = new DataView(localHeader.buffer);
    lhView.setUint32(0, 0x04034b50, true);  // Local file header signature
    lhView.setUint16(4, 20, true);           // Version needed
    lhView.setUint16(6, 0, true);            // General purpose flag
    lhView.setUint16(8, 0, true);            // Compression: stored
    lhView.setUint16(10, dosTime, true);     // Mod time
    lhView.setUint16(12, dosDate, true);     // Mod date
    lhView.setUint32(14, crc, true);         // CRC-32
    lhView.setUint32(18, data.length, true); // Compressed size
    lhView.setUint32(22, data.length, true); // Uncompressed size
    lhView.setUint16(26, nameBytes.length, true); // File name length
    lhView.setUint16(28, 0, true);           // Extra field length
    localHeader.set(nameBytes, 30);

    // Central directory header
    const centralDir = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(centralDir.buffer);
    cdView.setUint32(0, 0x02014b50, true);   // Central dir signature
    cdView.setUint16(4, 20, true);            // Version made by
    cdView.setUint16(6, 20, true);            // Version needed
    cdView.setUint16(8, 0, true);             // General purpose flag
    cdView.setUint16(10, 0, true);            // Compression: stored
    cdView.setUint16(12, dosTime, true);      // Mod time
    cdView.setUint16(14, dosDate, true);      // Mod date
    cdView.setUint32(16, crc, true);          // CRC-32
    cdView.setUint32(20, data.length, true);  // Compressed size
    cdView.setUint32(24, data.length, true);  // Uncompressed size
    cdView.setUint16(28, nameBytes.length, true); // File name length
    cdView.setUint16(30, 0, true);            // Extra field length
    cdView.setUint16(32, 0, true);            // Comment length
    cdView.setUint16(34, 0, true);            // Disk number start
    cdView.setUint16(36, 0, true);            // Internal attributes
    cdView.setUint32(38, 0, true);            // External attributes
    cdView.setUint32(42, 0, true);            // Local header offset
    centralDir.set(nameBytes, 46);

    const centralDirOffset = localHeader.length + data.length;

    // End of central directory record
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);  // EOCD signature
    eocdView.setUint16(4, 0, true);            // Disk number
    eocdView.setUint16(6, 0, true);            // Central dir disk
    eocdView.setUint16(8, 1, true);            // Entries on this disk
    eocdView.setUint16(10, 1, true);           // Total entries
    eocdView.setUint32(12, centralDir.length, true); // Central dir size
    eocdView.setUint32(16, centralDirOffset, true);  // Central dir offset
    eocdView.setUint16(20, 0, true);           // Comment length

    // Combine all parts
    const result = new Uint8Array(localHeader.length + data.length + centralDir.length + eocd.length);
    let offset = 0;
    result.set(localHeader, offset); offset += localHeader.length;
    result.set(data, offset); offset += data.length;
    result.set(centralDir, offset); offset += centralDir.length;
    result.set(eocd, offset);

    return result;
}

/**
 * Compute CRC-32 for a Uint8Array
 */
function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

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

        // Create feedback.json
        const feedbackJson = JSON.stringify({ title, description });
        const feedbackBlob = new Blob([feedbackJson], { type: 'application/json' });

        // Create zip containing feedback.json
        const zipData = createZip('feedback.json', new Uint8Array(await feedbackBlob.arrayBuffer()));

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
            body: zipData,
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

        return this._createReturnValue(null, json as any, title);
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
