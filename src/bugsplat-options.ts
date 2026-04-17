/**
 * A reference to a file on the local filesystem.
 *
 * Used on React Native, where FormData streams files from disk via their URI
 * (e.g. `file://`, `content://`, `ph://`) instead of reading them into JS memory.
 * Most RN file libraries (`expo-image-picker`, `react-native-view-shot`,
 * `expo-screen-capture`, etc.) already return values in this shape.
 */
export interface BugSplatFileRef {
    /**
     * The URI the runtime can read the file from.
     */
    uri: string;
    /**
     * The MIME type, e.g. `image/png`. Optional but recommended.
     */
    type?: string;
}

/**
 * A file attachment to include in the upload zip.
 */
export interface BugSplatAttachment {
    /**
     * The filename as it will appear inside the zip
     */
    filename: string;
    /**
     * The file contents.
     *
     * - `Blob` — browser `File`/`Blob` from an `<input type="file">` or `canvas.toBlob()`.
     * - `Uint8Array` — raw binary buffer (wrapped in a `Blob` before upload).
     * - `BugSplatFileRef` — `{ uri, type? }` reference for React Native file uploads.
     */
    data: Blob | Uint8Array | BugSplatFileRef;
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
