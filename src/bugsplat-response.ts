export interface BugSplatResponse {
    error?: Error | null;
    response?: any;
    original: Error | string;
}
