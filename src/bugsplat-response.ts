/**
 * Parsed response from BugSplat's commit S3 upload API.
 */
export interface BugSplatResponseBody {
    /**
     * Indicates if the post was successful
     */
    status: 'success' | 'fail';
    /**
     * Id of the newly created crash report
     */
    crashId: number;
    /**
     * Id of the stack key group
     */
    stackKeyId: number;
    /**
     * Id of the message
     */
    messageId: number;
    /**
     * URL to view the crash info (not always present in server response)
     */
    infoUrl?: string;
}

export interface BugSplatResponseType<ErrorType extends Error | null> {
    /**
     * Contains an error if one occurred.
     */
    error: ErrorType;
    /**
     * Response object. Validated if `error` is null.
     */
    response: ErrorType extends null ? BugSplatResponseBody : unknown;
    /**
     * The original error or title posted to BugSplat.
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
const isUndefined = (val: unknown): val is undefined => typeof val === 'undefined';

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
        isNumber(response['crashId']),
        isNumber(response['stackKeyId']),
        isNumber(response['messageId']),
        isString(response['infoUrl']) || isUndefined(response['infoUrl']),
    ];

    return conditions.every(Boolean);
}
