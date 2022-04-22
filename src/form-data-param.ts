/**
 * FormDataParam with a string value.
 */
interface FormDataStringParam {
    /**
     * Field key to store the value under
     */
    key: string;
    /**
     * Field `string` value
     */
    value: string;
}

/**
 * FormDataParam with a Blob value
 */
interface FormDataBlobParam {
    /**
     * Field key to store the value under
     */
    key: string;
    /**
     * Field `Blob` or `File` value.
     */
    value: Blob;
    filename?: string;
}

/**
 * Parameter used to construct a FormData object that will be sent to BugSplat.
 * It can have either a string or Blob value.
 */
export type FormDataParam = FormDataStringParam | FormDataBlobParam;

/**
 * Type guard to differentiate FormDataParam sub-type
 */
export function isFormDataStringParam(
    param: FormDataParam
): param is FormDataStringParam {
    return typeof param.value === 'string';
}
