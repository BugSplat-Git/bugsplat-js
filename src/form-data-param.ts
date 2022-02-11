interface FormDataStringParam {
    key: string;
    value: string;
}

interface FormDataBlobParam {
    key: string;
    value: Blob;
    filename?: string;
}

export type FormDataParam = FormDataStringParam | FormDataBlobParam;

export function isFormDataStringParam(
    param: FormDataParam
): param is FormDataStringParam {
    return typeof param.value === 'string';
}
