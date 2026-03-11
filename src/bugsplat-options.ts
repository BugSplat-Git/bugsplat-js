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

/**
 * A file attachment to include in the feedback zip (e.g. a screenshot).
 */
export interface BugSplatAttachment {
    /**
     * The filename as it will appear inside the zip
     */
    filename: string;
    /**
     * The file contents
     */
    data: Blob | Uint8Array;
}

/**
 * Additional parameters that can be passed to `postFeedback()`
 */
export interface BugSplatFeedbackOptions {
    /**
     * Additional feedback context
     */
    description?: string;
    /**
     * The email of the user submitting feedback
     */
    email?: string;
    /**
     * The name or id of the user submitting feedback
     */
    user?: string;
    /**
     * Additional metadata that can be queried via BugSplat's web application
     */
    appKey?: string;
    /**
     * File attachments to include in the feedback zip (e.g. screenshots)
     */
    attachments?: Array<BugSplatAttachment>;
    /**
     * Define arbitrary fields to be appended to the commit form data
     */
    additionalFormDataParams?: Array<FormDataParam>;
}
