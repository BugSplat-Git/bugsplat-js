import fetchPonyfill from 'fetch-ponyfill';
import { BugSplatOptions } from './bugsplat-options';
import { BugSplatResponse } from './bugsplat-response';
import FormData from 'form-data';

export class BugSplat {

    private _fetch = fetchPonyfill().fetch;
    private _formData = () => new FormData();

    private _appKey: string = '';
    private _description: string = '';
    private _email: string = '';
    private _user: string = '';

    constructor(
        public readonly database: string,
        public readonly application: string,
        public readonly version: string
    ) { }

    async post(errorToPost: Error | string, options?: BugSplatOptions): Promise<BugSplatResponse> {
        options = options || {};

        const appKey = options.appKey || this._appKey;
        const user = options.user || this._user;
        const email = options.email || this._email;
        const description = options.description || this._description;
        const additionalFormDataParams = options.additionalFormDataParams || [];
        const callstack = this._createStandardizedCallStack(
            (<Error>errorToPost)?.stack ? <Error>errorToPost : new Error(<string>errorToPost)
        );

        const url = 'https://' + this.database + '.bugsplat.com/post/js/';
        const method = 'POST';
        const body = <any>this._formData();
        body.append('database', this.database);
        body.append('appName', this.application);
        body.append('appVersion', this.version);
        body.append('appKey', appKey);
        body.append('user', user);
        body.append('email', email);
        body.append('description', description);
        body.append('callstack', callstack);
        additionalFormDataParams.forEach(param => body.append(param.key, param.value, param.options));

        console.log('BugSplat Error:', errorToPost);
        console.log('BugSplat Url:', url);

        const response = await this._fetch(url, { method, body });
        const json = await this._tryParseResponseJson(response);

        console.log('BugSplat POST status code:', response.status);
        console.log('BugSplat POST response body:', json);

        if (response.status === 400) {
            return this._createReturnValue(new Error('BugSplat Error: Bad request'), json, errorToPost);
        }

        if (response.status === 429) {
            return this._createReturnValue(new Error('BugSplat Error: Rate limit of one crash per second exceeded'), json, errorToPost);
        }

        if (!response.ok) {
            return this._createReturnValue(new Error('BugSplat Error: Unknown error'), json, errorToPost);
        }

        return this._createReturnValue(null, json, errorToPost);
    }

    setDefaultAppKey(appKey: string): void {
        this._appKey = appKey;
    }

    setDefaultDescription(description: string): void {
        this._description = description;
    }

    setDefaultEmail(email: string): void {
        this._email = email;
    }

    setDefaultUser(user: string): void {
        this._user = user;
    }
    
    private _createReturnValue(error: Error | null, response: any, original: Error | string): BugSplatResponse {
        return {
            error,
            response,
            original
        };
    }

    private _createStandardizedCallStack(error: Error): string {
        if (!error.stack?.includes('Error:')) {
            return `Error: ${error.message}\n${error.stack}`;
        }

        return error.stack;
    }

    private async _tryParseResponseJson(response: any) {
        let parsed;
        try {
            parsed = await response.json();
        } catch (_) {
            parsed = {};
        }
        return parsed;
    }
}
