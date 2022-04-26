import { FormDataParam } from './form-data-param';

/**
 * Additional parameters that can be passed to `post()`
 *
 * If any of `appKey`, `user`, `email`, `description` are set,
 * the corresponding default values will be overwritten
 */
export interface BugSplatOptions {
    /**
     * Define arbitrary fields to be appended to the form data
     * object to be sent. This is useful to pass any additional
     * data as string or `blob`.
     */
    additionalFormDataParams?: Array<FormDataParam>;
    /**
     * Additional metadata that can be queried via BugSplat's web application
     */
    appKey?: string;
    /**
     * Additional info about your crash that gets reset after every post
     */
    description?: string;
    /**
     * The email of your user
     */
    email?: string;
    /**
     * The name or id of your user
     */
    user?: string;
}
