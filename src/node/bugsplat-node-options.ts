import type { BugSplatOptions } from '../bugsplat-options';

/**
 * Options accepted by `BugSplatNode.post()` and `BugSplatNode.postFeedback()`.
 */
export interface BugSplatNodeOptions extends BugSplatOptions {
    /**
     * Paths of files on disk to upload with the report. Each file is read
     * and added to `attachments` under its base name. Files that do not
     * exist are skipped, as are files that would push the upload past 10 MB.
     */
    additionalFilePaths?: Array<string>;
}
