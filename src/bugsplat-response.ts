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
