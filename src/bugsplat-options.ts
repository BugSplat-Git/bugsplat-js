/**
 * A file attachment to include in the upload zip.
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
 * Additional parameters that can be passed to `post()` or `postFeedback()`
 *
 * If any of `appKey`, `user`, `email`, `description` are set,
 * the corresponding default values will be overwritten
 */
export interface BugSplatOptions {
    /**
     * Additional metadata that can be queried via BugSplat's web application
     */
    appKey?: string;
    /**
     * Key/value attributes to attach to the report.
     * These are searchable via BugSplat's web application.
     */
    attributes?: Record<string, string>;
    /**
     * File attachments to include in the upload zip
     */
    attachments?: Array<BugSplatAttachment>;
    /**
     * Additional info about the crash or feedback
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
