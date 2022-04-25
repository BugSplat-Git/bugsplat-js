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

const isObject = (val: unknown): val is object =>
    typeof val === 'object' && val !== null;
const isString = (val: unknown): val is string => typeof val === 'string';
const isNumber = (val: unknown): val is number => typeof val === 'number';
const isUndefined = (val: unknown): val is undefined => val === undefined;

export function validateResponseBody(
    response: unknown
): response is BugSplatResponseBody {
    if (!isObject(response)) {
        return false;
    }

    const conditions = [
        ['success', 'fail'].includes(response['status']),
        isNumber(response['current_server_time']),
        isString(response['message']),
        isString(response['url']) || isUndefined(response['url']),
        isNumber(response['crash_id']),
    ];

    return conditions.every(Boolean);
}
