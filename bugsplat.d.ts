declare class BugSplat {
    constructor(database: string, appName: string, appVersion: string);
    setDefaultAdditionalFilePaths(additionalFilePaths: Array<string>): void;
    setDefaultAppKey(appKey: string): void;
    setDefaultDescription(description: string): void;
    setDefaultEmail(email: string): void;
    setDefaultUser(user: string): void;
    async post(errorToPost: Error, options?: BugSplatOptions): Promise<BugSplatResponse>;
    async postAndExit(errorToPost: Error, options?: BugSplatOptions): Promise<void>;
}

interface BugSplatOptions {
    additionalFilePaths?: Array<string>;
    appKey?: string;
    description?:  string;
    email?: string;
    user?: string;
}

interface BugSplatResponse {
    error?: Error;
    response?: any;
    original: Error;
}