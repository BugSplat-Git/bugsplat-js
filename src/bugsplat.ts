import fetchPonyfill from 'fetch-ponyfill';
import FormData from 'form-data';
import type { BugSplatOptions } from './bugsplat-options';
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
    } catch (_) {
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
    private _fetch = fetchPonyfill().fetch;
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

        const url = 'https://' + this.database + '.bugsplat.com/post/js/';
        const method = 'POST';
        const body = this._formData() as unknown as globalThis.FormData;
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

        const response = await this._fetch(url, { method, body });
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
        response: ErrorType extends Error ? unknown : BugSplatResponseBody,
        original: Error | string
    ): BugSplatResponseType<ErrorType> {
        return {
            error,
            response,
            original,
        };
    }
}
