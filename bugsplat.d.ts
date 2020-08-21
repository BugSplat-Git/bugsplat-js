/// <reference types="node" />

export = BugSplat;

declare module "bugsplat" {
    export = BugSplat;
}

declare class BugSplat {
    constructor(database: string, appName: string, appVersion: string);
    setDefaultAppKey(appKey: string): void;
    setDefaultDescription(description: string): void;
    setDefaultEmail(email: string): void;
    setDefaultUser(user: string): void;
    post(errorToPost: Error, options?: BugSplatOptions): Promise<BugSplatResponse>;
    postAndExit(errorToPost: Error, options?: BugSplatOptions): Promise<void>;
}

interface FormDataParam {
    key: string;
    value: string | node.ReadStream;
}

interface BugSplatOptions {
    additionalFormDataParams?: Array<FormDataParam>;
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