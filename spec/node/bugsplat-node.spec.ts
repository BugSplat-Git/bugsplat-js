import type { Mock } from 'vitest';
import type { BugSplat } from '../../src/bugsplat';
import { BugSplatNode } from '../../src/node/index';

// Public surface plus the private collaborators the tests stub.
type Testable = { [K in keyof BugSplatNode]: BugSplatNode[K] } & {
    _bugsplat: BugSplat;
    _additionalFilePaths: Array<string>;
    _fs: { existsSync: Mock; promises: { stat: Mock; readFile: Mock } };
    _path: { basename: Mock };
    _console: { error: Mock };
    _process: { exit: Mock };
};

describe('BugSplatNode', () => {
    let bugsplatNode: Testable;

    beforeEach(() => {
        bugsplatNode = new BugSplatNode(
            'Fred',
            'my-node-crasher',
            '1.0.0'
        ) as unknown as Testable;
        vi.spyOn(bugsplatNode._bugsplat, 'setDefaultAppKey');
        vi.spyOn(bugsplatNode._bugsplat, 'setDefaultAttributes');
        vi.spyOn(bugsplatNode._bugsplat, 'setDefaultDescription');
        vi.spyOn(bugsplatNode._bugsplat, 'setDefaultEmail');
        vi.spyOn(bugsplatNode._bugsplat, 'setDefaultUser');
        vi.spyOn(bugsplatNode._bugsplat, 'post').mockResolvedValue(
            undefined as never
        );
        vi.spyOn(bugsplatNode._bugsplat, 'postFeedback').mockResolvedValue(
            undefined as never
        );
    });

    it('exposes database, application and version from the wrapped client', () => {
        expect(bugsplatNode.database).toEqual('Fred');
        expect(bugsplatNode.application).toEqual('my-node-crasher');
        expect(bugsplatNode.version).toEqual('1.0.0');
    });

    describe('defaults', () => {
        it('forwards setDefaultAppKey', () => {
            bugsplatNode.setDefaultAppKey('🐶');
            expect(bugsplatNode._bugsplat.setDefaultAppKey).toHaveBeenCalledWith('🐶');
        });

        it('forwards setDefaultAttributes', () => {
            bugsplatNode.setDefaultAttributes({ region: 'us' });
            expect(bugsplatNode._bugsplat.setDefaultAttributes).toHaveBeenCalledWith({
                region: 'us',
            });
        });

        it('forwards setDefaultDescription', () => {
            bugsplatNode.setDefaultDescription('🐶');
            expect(bugsplatNode._bugsplat.setDefaultDescription).toHaveBeenCalledWith(
                '🐶'
            );
        });

        it('forwards setDefaultEmail', () => {
            bugsplatNode.setDefaultEmail('🐶');
            expect(bugsplatNode._bugsplat.setDefaultEmail).toHaveBeenCalledWith('🐶');
        });

        it('forwards setDefaultUser', () => {
            bugsplatNode.setDefaultUser('🐶');
            expect(bugsplatNode._bugsplat.setDefaultUser).toHaveBeenCalledWith('🐶');
        });

        it('stores default additionalFilePaths', () => {
            const additionalPaths = ['/path/to/❤️'];
            bugsplatNode.setDefaultAdditionalFilePaths(additionalPaths);
            expect(bugsplatNode._additionalFilePaths).toEqual(additionalPaths);
        });
    });

    describe('post', () => {
        beforeEach(() => {
            stubFileSystem(bugsplatNode);
        });

        it('calls bugsplat.post with the error and options', async () => {
            const error = new Error('🐛');
            const options = { description: 'bar' };

            await bugsplatNode.post(error, options);

            expect(bugsplatNode._bugsplat.post).toHaveBeenCalledWith(error, {
                ...options,
                attachments: [],
            });
        });

        it('accepts a string message like the wrapped client', async () => {
            await bugsplatNode.post('something broke');

            expect(bugsplatNode._bugsplat.post).toHaveBeenCalledWith(
                'something broke',
                { attachments: [] }
            );
        });

        it('does not mutate the caller options', async () => {
            const options = { additionalFilePaths: ['👻'], description: 'd' };

            await bugsplatNode.post(new Error('oof'), options);

            expect(options).toEqual({
                additionalFilePaths: ['👻'],
                description: 'd',
            });
        });

        it('adds default additionalFilePaths as attachments', async () => {
            const filePath = '/path/to/❤️';
            const filename = '🐶';
            const value = '🐛';
            bugsplatNode._fs.promises.stat.mockResolvedValue({ size: 0 });
            bugsplatNode._fs.existsSync.mockReturnValue(true);
            bugsplatNode._fs.promises.readFile.mockResolvedValue(value);
            bugsplatNode._path.basename.mockReturnValue(filename);

            bugsplatNode.setDefaultAdditionalFilePaths([filePath]);
            await bugsplatNode.post(new Error('oof'));

            expect(bugsplatNode._fs.promises.stat).toHaveBeenCalledWith(filePath);
            expect(bugsplatNode._bugsplat.post).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    attachments: [{ filename, data: new Blob([value]) }],
                })
            );
        });

        it('keeps attachments passed in options ahead of file attachments', async () => {
            const inline = { filename: 'inline.txt', data: new Blob(['x']) };
            bugsplatNode._fs.promises.stat.mockResolvedValue({ size: 0 });
            bugsplatNode._fs.existsSync.mockReturnValue(true);
            bugsplatNode._fs.promises.readFile.mockResolvedValue('y');
            bugsplatNode._path.basename.mockReturnValue('disk.txt');

            await bugsplatNode.post(new Error('oof'), {
                attachments: [inline],
                additionalFilePaths: ['/disk.txt'],
            });

            expect(bugsplatNode._bugsplat.post).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    attachments: [
                        inline,
                        { filename: 'disk.txt', data: new Blob(['y']) },
                    ],
                })
            );
        });

        it('lets additionalFilePaths in options replace the defaults', async () => {
            const defaultFilePath = '/path/to/❤️';
            const optionsFilePath = '/path/to/💕';
            bugsplatNode._fs.promises.stat.mockResolvedValue({ size: 0 });
            bugsplatNode._fs.existsSync.mockReturnValue(true);
            bugsplatNode._fs.promises.readFile.mockResolvedValue('🐛');
            bugsplatNode._path.basename.mockReturnValue('🐶');

            bugsplatNode.setDefaultAdditionalFilePaths([defaultFilePath]);
            await bugsplatNode.post(new Error('oof'), {
                additionalFilePaths: [optionsFilePath],
            });

            expect(bugsplatNode._fs.promises.stat).not.toHaveBeenCalledWith(
                defaultFilePath
            );
            expect(bugsplatNode._fs.promises.stat).toHaveBeenCalledWith(
                optionsFilePath
            );
        });

        it('skips files that would push the upload past 10 MB and logs it', async () => {
            const filePath = '💪';
            bugsplatNode._fs.existsSync.mockReturnValue(true);
            bugsplatNode._fs.promises.stat.mockResolvedValue({ size: 10 * 1024 * 1024 + 1 });

            await bugsplatNode.post(new Error('oof'), { additionalFilePaths: [filePath] });

            expect(bugsplatNode._bugsplat.post).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ attachments: [] })
            );
            expect(bugsplatNode._console.error).toHaveBeenCalledWith(
                `BugSplat upload limit of 10MB exceeded, skipping file: ${filePath}`
            );
        });

        it('keeps earlier files when a later one exceeds the limit', async () => {
            bugsplatNode._fs.existsSync.mockReturnValue(true);
            bugsplatNode._fs.promises.stat
                .mockResolvedValueOnce({ size: 6 * 1024 * 1024 })
                .mockResolvedValueOnce({ size: 6 * 1024 * 1024 });
            bugsplatNode._fs.promises.readFile.mockResolvedValue('data');
            bugsplatNode._path.basename.mockImplementation((p: string) => p);

            await bugsplatNode.post(new Error('oof'), {
                additionalFilePaths: ['first', 'second'],
            });

            const [, options] = vi.mocked(bugsplatNode._bugsplat.post).mock.calls[0];
            expect(options?.attachments?.map((a) => a.filename)).toEqual(['first']);
        });

        it('logs and skips a file that does not exist', async () => {
            const filePath = '👻';
            bugsplatNode._fs.existsSync.mockReturnValue(false);

            await bugsplatNode.post(new Error('oof'), { additionalFilePaths: [filePath] });

            expect(bugsplatNode._fs.promises.readFile).not.toHaveBeenCalled();
            expect(bugsplatNode._console.error).toHaveBeenCalledWith(
                `BugSplat file doesn't exist at path: ${filePath}`
            );
        });
    });

    describe('postFeedback', () => {
        beforeEach(() => {
            stubFileSystem(bugsplatNode);
        });

        it('calls bugsplat.postFeedback with the title and options', async () => {
            const options = { description: 'some feedback' };

            await bugsplatNode.postFeedback('feedback title', options);

            expect(bugsplatNode._bugsplat.postFeedback).toHaveBeenCalledWith(
                'feedback title',
                { ...options, attachments: [] }
            );
        });

        it('converts additionalFilePaths to attachments', async () => {
            bugsplatNode._fs.promises.stat.mockResolvedValue({ size: 0 });
            bugsplatNode._fs.existsSync.mockReturnValue(true);
            bugsplatNode._fs.promises.readFile.mockResolvedValue('contents');
            bugsplatNode._path.basename.mockReturnValue('file');

            await bugsplatNode.postFeedback('title', {
                additionalFilePaths: ['/path/to/file'],
            });

            expect(bugsplatNode._bugsplat.postFeedback).toHaveBeenCalledWith(
                'title',
                expect.objectContaining({
                    attachments: [{ filename: 'file', data: new Blob(['contents']) }],
                })
            );
        });

        it('does not apply the default additionalFilePaths to feedback', async () => {
            bugsplatNode.setDefaultAdditionalFilePaths(['/crash-only.log']);

            await bugsplatNode.postFeedback('title');

            expect(bugsplatNode._fs.existsSync).not.toHaveBeenCalled();
            expect(bugsplatNode._bugsplat.postFeedback).toHaveBeenCalledWith('title', {
                attachments: [],
            });
        });
    });

    describe('postAndExit', () => {
        let post: Mock;

        beforeEach(() => {
            post = vi.spyOn(bugsplatNode, 'post').mockResolvedValue(undefined as never);
            bugsplatNode._process = { exit: vi.fn() };
        });

        it('posts with the error and options', async () => {
            const error = new Error('🐛');
            const options = { description: 'bar' };

            await bugsplatNode.postAndExit(error, options);

            expect(post).toHaveBeenCalledWith(error, options);
        });

        it('exits with code 1 after the post settles', async () => {
            let exitedBeforePostSettled = false;
            post.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => {
                            exitedBeforePostSettled =
                                bugsplatNode._process.exit.mock.calls.length > 0;
                            resolve(undefined);
                        }, 0)
                    )
            );

            await bugsplatNode.postAndExit(new Error('🐛'));

            expect(exitedBeforePostSettled).toBe(false);
            expect(bugsplatNode._process.exit).toHaveBeenCalledWith(1);
        });
    });
});

function stubFileSystem(bugsplatNode: Testable) {
    bugsplatNode._console = { error: vi.fn() };
    bugsplatNode._fs = {
        existsSync: vi.fn(),
        promises: { stat: vi.fn(), readFile: vi.fn() },
    };
    bugsplatNode._path = { basename: vi.fn() };
}
