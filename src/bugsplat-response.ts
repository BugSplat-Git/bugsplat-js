/**
 * Parsed response from BugSplat crash post API.
 */
export interface BugSplatResponseBody {
    /**
     * Indicates if the post was successful
     */
    status: 'success' | 'fail';
    /**
     * Server time when response was sent in seconds since epoch.
     *
     * Get a Date object with:
     * ```
     * new Date(response.current_server_time * 1000)
     * ```
     */
    current_server_time: number;
    /**
     * Message from the server
     */
    message: string;
    /**
     * Variable support response url
     */
    url?: string;
    /**
     * Id of the newly created crash report
     */
    crash_id: number;
}

/**
 * Post response from BugSplat that was successful.
 */
export interface BugSplatSuccessResponse {
    /**
     * Contains an error if one occurred. Always null for success response.
     */
    error: null;
    /**
     * Validated crash response object.
     */
    response: BugSplatResponseBody;
    /**
     * The original error posted to BugSplat
     */
    original: Error | string;
}

/**
 * Post response where an error has occurred.
 */
export interface BugSplatErrorResponse {
    /**
     * Contains an error if one occurred. Always an error for error response.
     */
    error: Error;
    /**
     * Crash response object. Unknown type because it may have failed validation.
     */
    response: unknown;
    /**
     * The original error posted to BugSplat
     */
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
