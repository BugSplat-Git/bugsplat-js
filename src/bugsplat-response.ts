export interface BugSplatResponseBody {
    status: 'success' | 'fail';
    current_server_time: number;
    message: string;
    url?: string;
    crash_id: number;
}

export interface BugSplatSuccessResponse {
    error: null;
    response: BugSplatResponseBody;
    original: Error | string;
}

export interface BugSplatErrorResponse {
    error: Error;
    response: unknown;
    original: Error | string;
}

export type BugSplatResponse = BugSplatSuccessResponse | BugSplatErrorResponse;

const isObject = (val: any): val is object =>
    typeof val === 'object' && val !== null;

export function validateResponseBody(
    response: unknown
): response is BugSplatResponseBody {
    return (
        isObject(response) &&
        (response['status'] === 'success' || response['status'] === 'fail') &&
        typeof response['current_server_time'] === 'number' &&
        typeof response['message'] === 'string' &&
        (typeof response['url'] === 'string' ||
            response['url'] === undefined) &&
        typeof response['crash_id'] === 'number'
    );
}
