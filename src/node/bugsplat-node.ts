import fs from 'fs';
import path from 'path';
import { BugSplat } from '../bugsplat';
import type { BugSplatAttachment } from '../bugsplat-options';
import type { BugSplatResponse } from '../bugsplat-response';
import type { BugSplatNodeOptions } from './bugsplat-node-options';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * BugSplat client for Node.js processes.
 *
 * Wraps `BugSplat` and adds what only makes sense with a filesystem and a
 * process: attachments read from file paths, and `postAndExit()` for
 * `uncaughtException` handlers.
 */
export class BugSplatNode {
    private _bugsplat: BugSplat;
    private _fs = fs;
    private _path = path;
    private _process = process;
    private _console = console;

    private _additionalFilePaths: Array<string> = [];

    get database(): string {
        return this._bugsplat.database;
    }

    get application(): string {
        return this._bugsplat.application;
    }

    get version(): string {
        return this._bugsplat.version;
    }

    constructor(database: string, application: string, version: string) {
        this._bugsplat = new BugSplat(database, application, version);
    }

    setDefaultAppKey(appKey: string): void {
        this._bugsplat.setDefaultAppKey(appKey);
    }

    setDefaultAttributes(attributes: Record<string, string>): void {
        this._bugsplat.setDefaultAttributes(attributes);
    }

    setDefaultDescription(description: string): void {
        this._bugsplat.setDefaultDescription(description);
    }

    setDefaultEmail(email: string): void {
        this._bugsplat.setDefaultEmail(email);
    }

    setDefaultUser(user: string): void {
        this._bugsplat.setDefaultUser(user);
    }

    /**
     * Files to upload with every report posted by this instance.
     * `post()` options with `additionalFilePaths` replace this list for that call.
     */
    setDefaultAdditionalFilePaths(additionalFilePaths: Array<string>): void {
        this._additionalFilePaths = additionalFilePaths;
    }

    /**
     * Posts an Error (or a message) to BugSplat, uploading `additionalFilePaths`
     * as attachments alongside any `attachments` already in the options.
     */
    async post(
        errorToPost: Error | string,
        options: BugSplatNodeOptions = {}
    ): Promise<BugSplatResponse> {
        const { additionalFilePaths, ...rest } = options;
        const fileAttachments = await this.createAttachmentsFromFilePaths(
            additionalFilePaths ?? this._additionalFilePaths
        );

        return this._bugsplat.post(errorToPost, {
            ...rest,
            attachments: [...(rest.attachments ?? []), ...fileAttachments],
        });
    }

    /**
     * Posts the error, then exits the process with code 1.
     * Intended for `process.on('uncaughtException', ...)` handlers.
     */
    async postAndExit(
        errorToPost: Error | string,
        options?: BugSplatNodeOptions
    ): Promise<never> {
        await this.post(errorToPost, options);
        return this._process.exit(1);
    }

    /**
     * Posts user feedback to BugSplat, uploading `additionalFilePaths` as attachments.
     * The instance's default file paths are not applied to feedback.
     */
    async postFeedback(
        title: string,
        options: BugSplatNodeOptions = {}
    ): Promise<BugSplatResponse> {
        const { additionalFilePaths, ...rest } = options;
        const fileAttachments = await this.createAttachmentsFromFilePaths(
            additionalFilePaths ?? []
        );

        return this._bugsplat.postFeedback(title, {
            ...rest,
            attachments: [...(rest.attachments ?? []), ...fileAttachments],
        });
    }

    private async createAttachmentsFromFilePaths(
        additionalFilePaths: Array<string>
    ): Promise<Array<BugSplatAttachment>> {
        const attachments: Array<BugSplatAttachment> = [];

        let totalZipSize = 0;
        for (const filePath of additionalFilePaths) {
            if (!this._fs.existsSync(filePath)) {
                this._console.error(
                    `BugSplat file doesn't exist at path: ${filePath}`
                );
                continue;
            }

            const { size } = await this._fs.promises.stat(filePath);
            if (totalZipSize + size > MAX_UPLOAD_BYTES) {
                this._console.error(
                    `BugSplat upload limit of 10MB exceeded, skipping file: ${filePath}`
                );
                continue;
            }

            totalZipSize += size;
            const fileContents = await this._fs.promises.readFile(filePath);
            attachments.push({
                filename: this._path.basename(filePath),
                data: new Blob([fileContents]),
            });
        }

        return attachments;
    }
}
