export interface FormDataParam {
    key: string;
    value: string | Blob;
    options?: AppendOptions | string;
}

interface AppendOptions {
    header?: string | Headers;
    knownLength?: number;
    filename?: string;
    filepath?: string;
    contentType?: string;
}
