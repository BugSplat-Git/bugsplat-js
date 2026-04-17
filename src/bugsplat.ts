import type { BugSplatAttachment, BugSplatFileRef, BugSplatOptions } from './bugsplat-options';
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

function isFileRef(data: unknown): data is BugSplatFileRef {
    return typeof data === 'object' && data !== null && typeof (data as BugSplatFileRef).uri === 'string';
}

function isReactNative(): boolean {
    return typeof navigator !== 'undefined' &&
        (navigator as { product?: string }).product === 'ReactNative';
}

function utf8ToBase64(text: string): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(text, 'utf-8').toString('base64');
    }
    // Browser-safe UTF-8 → base64
    return btoa(unescape(encodeURIComponent(text)));
}

/**
 * Append an attachment to a multipart body, branching on the runtime shape of
 * `data` so that each environment's FormData serializes it as a real file part
 * (with a `filename` in the `Content-Disposition` header) rather than a plain
 * form field.
 *
 * - `string` — wrapped as a `text/plain` file part. On web this is a `Blob`;
 *   on React Native (where FormData can't serialize browser `Blob` objects) it
 *   becomes a base64 `data:` URI in RN's `{ uri, type, name }` shape.
 * - `Uint8Array` — wrapped in a `Blob` for browser FormData.
 * - `Blob` — appended with filename so the server sees it as an upload.
 * - `BugSplatFileRef` (`{ uri, type? }`) — RN's file-upload shape, streamed
 *   from disk by RN's fetch.
 */
export function appendAttachment(body: FormData, attachment: BugSplatAttachment): void {
    const { filename, data } = attachment;

    if (typeof data === 'string') {
        if (isReactNative()) {
            body.append(
                filename,
                {
                    uri: `data:text/plain;base64,${utf8ToBase64(data)}`,
                    type: 'text/plain',
                    name: filename,
                } as unknown as Blob,
                filename
            );
        } else {
            body.append(
                filename,
                new Blob([data], { type: 'text/plain' }),
                filename
            );
        }
        return;
    }

    if (data instanceof Uint8Array) {
        body.append(filename, new Blob([data.buffer as ArrayBuffer]), filename);
        return;
    }

    if (isFileRef(data)) {
        body.append(
            filename,
            { uri: data.uri, type: data.type, name: filename } as unknown as Blob,
            filename
        );
        return;
    }

    body.append(filename, data, filename);
}

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
        const attributes = options.attributes || this._attributes;
        const callstack = createStandardizedCallStack(
            isError(errorToPost) ? errorToPost : new Error(errorToPost)
        );

        const url = this._getEnv('BUGSPLAT_CRASH_POST_URL') || `https://${this.database}.bugsplat.com/post/js/`;
        const body = this._formData();
        body.append('database', this.database);
        body.append('appName', this.application);
        body.append('appVersion', this.version);
        body.append('appKey', appKey);
        body.append('user', user);
        body.append('email', email);
        body.append('description', description);
        body.append('callstack', callstack);
        if (Object.keys(attributes).length > 0) {
            body.append('attributes', JSON.stringify(attributes));
        }
        for (const attachment of options.attachments || []) {
            appendAttachment(body, attachment);
        }

        console.log('BugSplat Error:', errorToPost);
        console.log('BugSplat Url:', url);

        const response = await globalThis.fetch(url, { method: 'POST', body });
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
     * Posts user feedback to BugSplat
     * @param title - Feedback title, used as the stack key for grouping
     * @param options - Additional parameters for the feedback submission
     */
    async postFeedback(
        title: string,
        options?: BugSplatOptions
    ): Promise<BugSplatResponse> {
        options = options || {};

        const appKey = options.appKey || this._appKey;
        const user = options.user || this._user;
        const email = options.email || this._email;
        const description = options.description || this._description;
        const attributes = options.attributes || this._attributes;
        const baseUrl = this._getEnv('BUGSPLAT_FEEDBACK_POST_URL') || `https://${this.database}.bugsplat.com/post/feedback/`;

        const body = this._formData();
        body.append('database', this.database);
        body.append('appName', this.application);
        body.append('appVersion', this.version);
        body.append('title', title);
        body.append('appKey', appKey);
        body.append('user', user);
        body.append('email', email);
        body.append('description', description);
        if (Object.keys(attributes).length > 0) {
            body.append('attributes', JSON.stringify(attributes));
        }
        for (const attachment of options.attachments || []) {
            appendAttachment(body, attachment);
        }

        console.log('BugSplat Feedback:', title);

        const response = await globalThis.fetch(baseUrl, { method: 'POST', body });
        const json = await tryParseResponseJson(response);

        if (!response.ok) {
            return this._createReturnValue(
                new Error('BugSplat Error: Failed to post feedback'),
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

    private _getEnv(key: string): string | undefined {
        return typeof process !== 'undefined' ? process.env?.[key] : undefined;
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
