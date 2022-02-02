export interface BugSplatResponseBody {
    status: 'success' | 'fail';
    current_server_time: number;
    message: string;
    url: string;
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

export function validateResponseBody(
    response: unknown
): response is BugSplatResponseBody {
    return (
        typeof response === 'object' &&
        response !== null &&
        (response['status'] === 'success' || response['status'] === 'fail') &&
        typeof response['current_server_time'] === 'number' &&
        typeof response['message'] === 'string' &&
        typeof response['url'] === 'string' &&
        typeof response['crash_id'] === 'number'
    );
}
