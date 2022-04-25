/**
 * Parsed response from BugSplat crash post API.
 */
export interface BugSplatResponseBody {
    /**
     * Indicates if the post was successful
     */
    status: 'success' | 'fail';
    /**
     * Server time in seconds since epoch.
     *
     * Get a Date object with:
     * ```
     * new Date(response.current_server_time * 1000)
     * ```
     */
    current_server_time: number;
    message: string;
    /**
     * Support response url
     */
    url?: string;
    /**
     * Id of the newly created crash report
     */
    crash_id: number;
}

export interface BugSplatResponseType<ErrorType extends Error | null> {
    /**
     * Contains an error if one occurred.
     */
    error: ErrorType;
    /**
     * Crash response object. Validated if `error` is null.
     */
    response: ErrorType extends Error ? unknown : BugSplatResponseBody;
    /**
     * The original error posted to BugSplat.
     */
    original: Error | string;
}

export type BugSplatResponse =
    | BugSplatResponseType<null>
    | BugSplatResponseType<Error>;

const isObject = (val: unknown): val is object =>
    typeof val === 'object' && val !== null;
const isString = (val: unknown): val is string => typeof val === 'string';
const isNumber = (val: unknown): val is number => typeof val === 'number';
const isUndefined = (val: unknown): val is undefined => val === undefined;

/**
 * Ensure the response body has the expected properties.
 */
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
