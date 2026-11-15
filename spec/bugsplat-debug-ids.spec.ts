import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    collectDebugIds,
    createDebugMeta,
    getDebugIds,
    getStackFile,
} from '../src/bugsplat-debug-ids';

const ID_A = '9f2c1a7e-3b4d-4c5e-8f60-112233445566';
const ID_B = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f00112233';
const ID_C = 'c0ffee00-1234-4abc-9def-0123456789ab';

type Global = { _debugIds?: unknown };

function setRegistry(registry: unknown): void {
    (globalThis as Global)._debugIds = registry;
}

afterEach(() => {
    delete (globalThis as Global)._debugIds;
    vi.restoreAllMocks();
});

describe('getStackFile', () => {
    // Each stack below is what `new Error().stack` holds when the registration
    // snippet runs: an anonymous function called from the top level of the
    // file. The V8 and JavaScriptCore shapes were captured from Chrome 150,
    // Node.js 24, Deno, Bun and the JavaScriptCore shell, with hosts and
    // directories swapped for neutral ones.
    const supported: Array<[name: string, stack: string, file: string]> = [
        [
            'Chrome, classic script with a query string',
            'Error\n' +
                '    at https://app.example.com/assets/index-BX3k.js?v=1.2.3:3:142\n' +
                '    at https://app.example.com/assets/index-BX3k.js?v=1.2.3:3:230',
            'https://app.example.com/assets/index-BX3k.js?v=1.2.3',
        ],
        [
            'Chrome, module script with an @ in the path',
            'Error\n' +
                '    at https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js:3:142\n' +
                '    at https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js:3:229',
            'https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js',
        ],
        [
            'Chrome, dev server with a port',
            'Error\n' +
                '    at http://localhost:5173/src/main.ts?t=1731600000000:12:3\n' +
                '    at http://localhost:5173/src/main.ts?t=1731600000000:12:90',
            'http://localhost:5173/src/main.ts?t=1731600000000',
        ],
        [
            'Node.js CommonJS, absolute POSIX path',
            'Error\n' +
                '    at /srv/app/dist/main.js:3:142\n' +
                '    at Object.<anonymous> (/srv/app/dist/main.js:3:259)\n' +
                '    at Module._compile (node:internal/modules/cjs/loader:1929:14)\n' +
                '    at Object..js (node:internal/modules/cjs/loader:2060:10)\n' +
                '    at Module.load (node:internal/modules/cjs/loader:1651:32)\n' +
                '    at Module._load (node:internal/modules/cjs/loader:1443:12)\n' +
                '    at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)\n' +
                '    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)\n' +
                '    at node:internal/main/run_main_module:33:47',
            '/srv/app/dist/main.js',
        ],
        [
            'Node.js CommonJS, directory with spaces and parentheses',
            'Error\n' +
                '    at /Users/dev/My App (x86)/chunk.js:3:142\n' +
                '    at Object.<anonymous> (/Users/dev/My App (x86)/chunk.js:3:259)\n' +
                '    at Module._compile (node:internal/modules/cjs/loader:1929:14)',
            '/Users/dev/My App (x86)/chunk.js',
        ],
        [
            'Node.js ES module, file URL',
            'Error\n' +
                '    at file:///srv/app/dist/main.mjs:3:142\n' +
                '    at file:///srv/app/dist/main.mjs:3:259\n' +
                '    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)\n' +
                '    at async node:internal/modules/esm/loader:647:26\n' +
                '    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)',
            'file:///srv/app/dist/main.mjs',
        ],
        [
            'Node.js ES module, percent-encoded file URL',
            'Error\n' +
                '    at file:///Users/dev/My%20App%20(x86)/chunk.mjs:3:142\n' +
                '    at file:///Users/dev/My%20App%20(x86)/chunk.mjs:3:259',
            'file:///Users/dev/My%20App%20(x86)/chunk.mjs',
        ],
        [
            'Node.js CommonJS on Windows',
            'Error\n' +
                '    at C:\\Users\\dev\\app\\dist\\main.js:3:142\n' +
                '    at Object.<anonymous> (C:\\Users\\dev\\app\\dist\\main.js:3:259)\n' +
                '    at Module._compile (node:internal/modules/cjs/loader:1929:14)',
            'C:\\Users\\dev\\app\\dist\\main.js',
        ],
        [
            'Windows path with parentheses, anonymous first frame',
            'Error\n' +
                '    at C:\\Program Files (x86)\\My App\\resources\\app\\main.js:3:142\n' +
                '    at Object.<anonymous> (C:\\Program Files (x86)\\My App\\resources\\app\\main.js:3:259)',
            'C:\\Program Files (x86)\\My App\\resources\\app\\main.js',
        ],
        [
            'Windows path with parentheses, named first frame',
            'Error\n' +
                '    at Object.<anonymous> (C:\\Program Files (x86)\\My App\\resources\\app\\main.js:3:259)\n' +
                '    at Module._compile (node:internal/modules/cjs/loader:1929:14)',
            'C:\\Program Files (x86)\\My App\\resources\\app\\main.js',
        ],
        [
            'Windows UNC path',
            'Error\n    at \\\\build\\share\\app\\main.js:3:142',
            '\\\\build\\share\\app\\main.js',
        ],
        [
            'Node.js ES module on Windows',
            'Error\n    at file:///C:/Users/dev/app/dist/main.mjs:3:142',
            'file:///C:/Users/dev/app/dist/main.mjs',
        ],
        [
            'Electron renderer on a custom scheme',
            'Error\n' +
                '    at app://./assets/index-BX3k.js:3:142\n' +
                '    at app://./assets/index-BX3k.js:3:230',
            'app://./assets/index-BX3k.js',
        ],
        [
            'Electron renderer loaded from an asar archive',
            'Error\n    at file:///C:/Program%20Files/My%20App/resources/app.asar/dist/renderer.js:3:142',
            'file:///C:/Program%20Files/My%20App/resources/app.asar/dist/renderer.js',
        ],
        [
            'Bun, which names the anonymous function',
            'Error\n' +
                '    at <anonymous> (/srv/app/dist/chunk.js:3:148)\n' +
                '    at /srv/app/dist/chunk.js:3:256',
            '/srv/app/dist/chunk.js',
        ],
        [
            'V8, named function',
            'Error\n' +
                '    at registerDebugId (https://app.example.com/assets/vendor.js:1:2345)\n' +
                '    at https://app.example.com/assets/vendor.js:1:2400',
            'https://app.example.com/assets/vendor.js',
        ],
        [
            'V8, method with an alias',
            'Error\n    at Object.register [as init] (https://app.example.com/assets/vendor.js:1:2345)',
            'https://app.example.com/assets/vendor.js',
        ],
        [
            'V8, constructor',
            'Error\n    at new Registry (https://app.example.com/assets/vendor.js:1:2345)',
            'https://app.example.com/assets/vendor.js',
        ],
        [
            'V8, anonymous async frame',
            'Error\n    at async file:///srv/app/dist/main.mjs:3:142',
            'file:///srv/app/dist/main.mjs',
        ],
        [
            'V8, error message on the first line',
            'Error: registering\n    at https://app.example.com/assets/index.js:1:10',
            'https://app.example.com/assets/index.js',
        ],
        [
            'webpack eval devtool module',
            'Error\n    at eval (webpack-internal:///./src/index.js:5:1)',
            'webpack-internal:///./src/index.js',
        ],
        [
            'Firefox, anonymous function',
            '@https://app.example.com/assets/index-BX3k.js?v=1.2.3:3:142\n' +
                '@https://app.example.com/assets/index-BX3k.js?v=1.2.3:3:230\n',
            'https://app.example.com/assets/index-BX3k.js?v=1.2.3',
        ],
        [
            'Firefox, named function',
            'registerDebugId@https://app.example.com/assets/vendor.js:1:2345\n' +
                '@https://app.example.com/assets/vendor.js:1:2400\n',
            'https://app.example.com/assets/vendor.js',
        ],
        [
            'Firefox, nested anonymous function name',
            'init/<@https://app.example.com/assets/vendor.js:1:2345\n',
            'https://app.example.com/assets/vendor.js',
        ],
        [
            'Firefox, an @ in the path',
            '@https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js:3:142\n',
            'https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js',
        ],
        [
            'Firefox, file URL on Windows',
            '@file:///C:/Users/dev/app/index.js:3:142\n',
            'file:///C:/Users/dev/app/index.js',
        ],
        [
            'Safari, anonymous function',
            '@https://app.example.com/assets/index-BX3k.js?v=1.2.3:3:142\n' +
                'global code@https://app.example.com/assets/index-BX3k.js?v=1.2.3:3:259',
            'https://app.example.com/assets/index-BX3k.js?v=1.2.3',
        ],
        [
            'Safari, top-level code',
            'global code@https://app.example.com/assets/index.js:3:259',
            'https://app.example.com/assets/index.js',
        ],
        [
            'Safari, module code with an @ in the path',
            'module code@https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js:3:259',
            'https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js',
        ],
        [
            'JavaScriptCore, frame without a function name or @',
            'https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js:3:142\n' +
                'global code@https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js:3:259',
            'https://cdn.example.com/npm/pkg@1.0.0/dist/mod.js',
        ],
        [
            'JavaScriptCore, absolute path in a scoped package',
            '@/srv/app/node_modules/@scope/pkg/index.js:3:142\n' +
                'module code@/srv/app/node_modules/@scope/pkg/index.js:3:259',
            '/srv/app/node_modules/@scope/pkg/index.js',
        ],
        [
            'JavaScriptCore, line without a column',
            'global code@https://app.example.com/assets/index.js:3',
            'https://app.example.com/assets/index.js',
        ],
    ];

    it.each(supported)('reads the file from %s', (_name, stack, file) => {
        expect(getStackFile(stack)).toBe(file);
    });

    it.each(supported)(
        'returns a file that is a frame location in %s',
        (_name, stack, file) => {
            expect(stack).toContain(`${file}:`);
        },
    );

    const unsupported: Array<[name: string, stack: string]> = [
        ['an empty string', ''],
        ['a stack with no frames', 'Error'],
        ['text that is not a stack', 'not a stack at all'],
        ['a V8 frame typed into the console', 'Error\n    at <anonymous>:1:1'],
        [
            'a V8 frame inside eval',
            'Error\n' +
                '    at eval (eval at load (https://app.example.com/assets/index.js:1:2), <anonymous>:1:5)\n' +
                '    at load (https://app.example.com/assets/index.js:1:2)',
        ],
        [
            'a V8 first frame with no file, followed by one with a file',
            'Error\n' +
                '    at Array.forEach (<anonymous>)\n' +
                '    at https://app.example.com/assets/index.js:1:2',
        ],
        [
            'a V8 frame with no line number',
            'Error\n    at register (https://app.example.com/assets/index.js)',
        ],
        [
            'a Firefox frame inside eval',
            '@https://app.example.com/assets/index.js line 3 > eval:1:1\n' +
                '@https://app.example.com/assets/index.js:3:10\n',
        ],
        [
            'a Firefox frame inside new Function',
            'anonymous@https://app.example.com/assets/index.js line 3 > Function:1:1\n',
        ],
        [
            'a Safari native first frame',
            '[native code]\nglobal code@https://app.example.com/assets/index.js:3:259',
        ],
        [
            'a Safari native frame with a function name',
            'forEach@[native code]\nglobal code@https://app.example.com/assets/index.js:3:259',
        ],
    ];

    it.each(unsupported)('returns undefined for %s', (_name, stack) => {
        expect(getStackFile(stack)).toBeUndefined();
    });
});

describe('getDebugIds', () => {
    const chromeKey = (file: string) =>
        `Error\n    at ${file}:3:142\n    at ${file}:3:230`;

    it('returns an empty object when the registry is missing', () => {
        expect(getDebugIds()).toEqual({});
    });

    it.each([
        ['null', null],
        ['a string', 'nope'],
        ['a number', 42],
        ['a boolean', true],
        ['a function', () => ({})],
        ['an empty array', []],
        ['an array of strings', ['a', 'b']],
    ])('returns an empty object when the registry is %s', (_name, registry) => {
        setRegistry(registry);

        expect(getDebugIds()).toEqual({});
    });

    it('maps each registered file to its debug ID', () => {
        setRegistry({
            [chromeKey('https://app.example.com/assets/index-BX3k.js')]: ID_A,
            [chromeKey('https://app.example.com/assets/vendor-9d1c.js')]: ID_B,
            '@https://app.example.com/assets/lazy.js:1:10\n': ID_C,
        });

        expect(getDebugIds()).toEqual({
            'https://app.example.com/assets/index-BX3k.js': ID_A,
            'https://app.example.com/assets/vendor-9d1c.js': ID_B,
            'https://app.example.com/assets/lazy.js': ID_C,
        });
    });

    it('returns the ID as the build wrote it', () => {
        const upper = ID_A.toUpperCase();
        const bare = ID_B.replace(/-/g, '');
        setRegistry({
            [chromeKey('https://app.example.com/a.js')]: upper,
            [chromeKey('https://app.example.com/b.js')]: bare,
        });

        expect(getDebugIds()).toEqual({
            'https://app.example.com/a.js': upper,
            'https://app.example.com/b.js': bare,
        });
    });

    it('leaves out values that are not debug IDs', () => {
        setRegistry({
            [chromeKey('https://app.example.com/number.js')]: 42,
            [chromeKey('https://app.example.com/object.js')]: { id: ID_A },
            [chromeKey('https://app.example.com/empty.js')]: '',
            [chromeKey('https://app.example.com/short.js')]: '9f2c1a7e',
            [chromeKey('https://app.example.com/words.js')]: 'not-a-debug-id',
            [chromeKey('https://app.example.com/long.js')]: `${ID_A}0`,
            [chromeKey('https://app.example.com/good.js')]: ID_A,
        });

        expect(getDebugIds()).toEqual({
            'https://app.example.com/good.js': ID_A,
        });
    });

    it('leaves out keys whose first frame names no file', () => {
        setRegistry({
            'Error\n    at <anonymous>:1:1': ID_A,
            'not a stack': ID_B,
            '': ID_C,
        });

        expect(getDebugIds()).toEqual({});
    });

    it('keeps the latest registration when a file registers twice', () => {
        const file = 'https://app.example.com/assets/index.js';
        setRegistry({
            [`Error\n    at ${file}:1:100`]: ID_A,
            [`Error\n    at ${file}:1:200`]: ID_B,
        });

        expect(getDebugIds()).toEqual({ [file]: ID_B });
    });

    it('picks up files registered after an earlier call', () => {
        const registry: Record<string, string> = {
            [chromeKey('https://app.example.com/a.js')]: ID_A,
        };
        setRegistry(registry);
        expect(getDebugIds()).toEqual({ 'https://app.example.com/a.js': ID_A });

        registry[chromeKey('https://app.example.com/b.js')] = ID_B;

        expect(getDebugIds()).toEqual({
            'https://app.example.com/a.js': ID_A,
            'https://app.example.com/b.js': ID_B,
        });
    });

    it('parses each registered stack once', () => {
        // File names no other test registers, so neither stack is cached yet.
        const first = chromeKey('https://app.example.com/once-a.js');
        const second = chromeKey('https://app.example.com/once-b.js');
        const registry: Record<string, string> = { [first]: ID_A };
        setRegistry(registry);
        // getStackFile() starts by splitting the stack into lines.
        const split = vi.spyOn(String.prototype, 'split');
        const parses = (stack: string) =>
            split.mock.contexts.filter((context) => String(context) === stack)
                .length;

        getDebugIds();
        getDebugIds();
        registry[second] = ID_B;
        const debugIds = getDebugIds();

        expect(parses(first)).toBe(1);
        expect(parses(second)).toBe(1);
        expect(debugIds).toEqual({
            'https://app.example.com/once-a.js': ID_A,
            'https://app.example.com/once-b.js': ID_B,
        });
    });

    it('returns a new object on every call', () => {
        setRegistry({ [chromeKey('https://app.example.com/a.js')]: ID_A });

        const debugIds = getDebugIds();
        debugIds['https://app.example.com/b.js'] = ID_B;

        expect(getDebugIds()).toEqual({ 'https://app.example.com/a.js': ID_A });
    });

    it('does not throw when reading the registry throws', () => {
        Object.defineProperty(globalThis, '_debugIds', {
            configurable: true,
            get() {
                throw new Error('nope');
            },
        });

        expect(getDebugIds()).toEqual({});
    });

    it('does not throw when listing the registry keys throws', () => {
        setRegistry(
            new Proxy(
                {},
                {
                    ownKeys() {
                        throw new Error('nope');
                    },
                },
            ),
        );

        expect(getDebugIds()).toEqual({});
    });

    it('keeps what it read before a registry value threw', () => {
        const registry: Record<string, string> = {
            [chromeKey('https://app.example.com/a.js')]: ID_A,
        };
        Object.defineProperty(registry, chromeKey('https://app.example.com/b.js'), {
            enumerable: true,
            get() {
                throw new Error('nope');
            },
        });
        setRegistry(registry);

        expect(getDebugIds()).toEqual({ 'https://app.example.com/a.js': ID_A });
    });
});

describe('collectDebugIds', () => {
    const file = 'https://app.example.com/assets/index.js';

    it('returns the registry entries when nothing is passed', () => {
        setRegistry({ [`Error\n    at ${file}:1:1`]: ID_A });

        expect(collectDebugIds()).toEqual({ [file]: ID_A });
    });

    it('lets explicit entries replace and extend the registry entries', () => {
        setRegistry({ [`Error\n    at ${file}:1:1`]: ID_A });

        expect(
            collectDebugIds({ [file]: ID_B, 'app://./renderer.js': ID_C }),
        ).toEqual({ [file]: ID_B, 'app://./renderer.js': ID_C });
    });

    it('ignores explicit entries that are not debug IDs', () => {
        setRegistry({ [`Error\n    at ${file}:1:1`]: ID_A });

        expect(
            collectDebugIds({
                [file]: 'not-a-debug-id',
                'app://./renderer.js': 42 as unknown as string,
                '': ID_C,
            }),
        ).toEqual({ [file]: ID_A });
    });

    it.each([
        ['null', null],
        ['a string', 'nope'],
        ['a number', 42],
    ])('ignores explicit IDs passed as %s', (_name, explicit) => {
        expect(
            collectDebugIds(explicit as unknown as Record<string, string>),
        ).toEqual({});
    });
});

describe('createDebugMeta', () => {
    const index = 'https://app.example.com/assets/index-BX3k.js';
    const vendor = 'https://app.example.com/assets/vendor-9d1c.js';
    const lazy = 'https://app.example.com/assets/lazy-77aa.js';
    const debugIds = { [lazy]: ID_C, [vendor]: ID_B, [index]: ID_A };

    it('lists only the files a stack names', () => {
        const stack =
            'TypeError: x is not a function\n' +
            `    at render (${index}:1:2345)\n` +
            `    at ${index}:1:9000`;

        expect(createDebugMeta([stack], debugIds)).toEqual([
            { file: index, debugId: ID_A },
        ]);
    });

    it('orders rows by first appearance, the posted error first', () => {
        const root =
            'Error: root\n' +
            `    at a (${vendor}:1:10)\n` +
            `    at b (${index}:1:20)`;
        const cause = `Error: cause\n    at c (${lazy}:1:30)\n    at d (${vendor}:1:40)`;

        expect(createDebugMeta([root, cause], debugIds)).toEqual([
            { file: vendor, debugId: ID_B },
            { file: index, debugId: ID_A },
            { file: lazy, debugId: ID_C },
        ]);
    });

    it('matches Firefox and Safari frames', () => {
        const stack = `render@${index}:1:2345\n@${index}:1:9000\n`;

        expect(createDebugMeta([stack], debugIds)).toEqual([
            { file: index, debugId: ID_A },
        ]);
    });

    it('does not match a file that is only the start of a longer file name', () => {
        const stack = `Error\n    at f (${index}.map:1:1)\n    at g (${index}?v=2:1:1)`;

        expect(createDebugMeta([stack], debugIds)).toEqual([]);
    });

    it('does not match a file that is only the end of a longer path', () => {
        const ids = { '/srv/app.js': ID_A };
        const stack = 'Error\n    at f (/opt/srv/app.js:1:1)';

        expect(createDebugMeta([stack], ids)).toEqual([]);
        expect(createDebugMeta(['f@/opt/srv/app.js:1:1'], ids)).toEqual([]);
    });

    it('does not match a file that only the error message names', () => {
        const stack =
            `Error: Unable to fetch ${vendor}: 404 (see ${lazy}:1:1)\n` +
            `    at load (${index}:1:10)`;

        expect(createDebugMeta([stack], debugIds)).toEqual([
            { file: index, debugId: ID_A },
        ]);
    });

    it('does not match a message line that looks like a frame location', () => {
        const stack = `Error: failed\n${vendor}:1:1\n    at load (${index}:1:10)`;

        expect(createDebugMeta([stack], debugIds)).toEqual([
            { file: index, debugId: ID_A },
        ]);
    });

    it('matches the file that called eval in a V8 frame', () => {
        const stack =
            'Error\n' +
            `    at eval (eval at render (${index}:1:2345), <anonymous>:1:7)`;

        expect(createDebugMeta([stack], debugIds)).toEqual([
            { file: index, debugId: ID_A },
        ]);
    });

    it('matches frames whose file has a port, a drive letter or parentheses', () => {
        const port = 'http://localhost:5173/assets/index.js';
        const drive = 'C:\\Program Files (x86)\\app\\main.js';
        const stack =
            `Error\n    at f (${port}:1:2)\n    at async g (${drive}:3:4)\n    at ${port}:5:6`;

        expect(
            createDebugMeta([stack], { [drive]: ID_B, [port]: ID_A }),
        ).toEqual([
            { file: port, debugId: ID_A },
            { file: drive, debugId: ID_B },
        ]);
    });

    it('skips entries without a stack', () => {
        const stack = `Error\n    at f (${index}:1:1)`;

        expect(createDebugMeta([undefined, stack], debugIds)).toEqual([
            { file: index, debugId: ID_A },
        ]);
    });

    it('returns an empty list when there are no IDs or no stacks', () => {
        expect(createDebugMeta([`Error\n    at f (${index}:1:1)`], {})).toEqual([]);
        expect(createDebugMeta([], debugIds)).toEqual([]);
    });
});
