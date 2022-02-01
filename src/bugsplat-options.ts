import { FormDataParam } from './form-data-param';

export interface BugSplatOptions {
    additionalFormDataParams?: Array<FormDataParam>;
    appKey?: string;
    description?: string;
    email?: string;
    user?: string;
}
