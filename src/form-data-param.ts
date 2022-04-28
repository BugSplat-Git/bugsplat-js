interface FormDataParamType<T extends string | Blob> {
    /**
     * The name of the field whose data is contained in `value`.
     */
    key: string;
    /**
     * The field's value.
     */
    value: T;
    /**
     * The filename reported to the server
     * when `value` is a `Blob` or `File`
     */
    filename?: T extends string ? never : string;
}

/**
 * Simple object that is used to construct `FormData` objects.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/FormData/append
 */
export type FormDataParam = FormDataParamType<string> | FormDataParamType<Blob>;

/**
 * Check if FormField has a string value
 */
export function isFormDataParamString(
    param: FormDataParam
): param is FormDataParamType<string> {
    return typeof param.value === 'string';
}
