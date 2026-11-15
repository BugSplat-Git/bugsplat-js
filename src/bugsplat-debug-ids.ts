/**
 * One row of the `debugMeta` list `post()` adds to the `exceptions` form
 * field: a script file that appears in a posted stack and the source map
 * debug ID its build wrote into it.
 */
export interface BugSplatDebugMeta {
    /**
     * The file exactly as stack frames name it: same scheme, host, path and
     * query string.
     */
    file: string;
    /**
     * The debug ID as the build wrote it, usually a lowercase hyphenated UUID.
     */
    debugId: string;
}

const NORMALISED_DEBUG_ID = /^[0-9a-f]{32}$/;
const V8_FRAME = /^\s*at /;
/**
 * `file:line` or `file:line:column`. The lazy group stops at the last one or
 * two numeric suffixes, so ports and drive letters stay part of the file.
 */
const LOCATION = /^(.+?)(?::\d+){1,2}$/;
/**
 * Start of a URL (`https:`, `file:`, `app:`, `C:`) or an absolute POSIX path.
 */
const FILE_START = /^(?:[a-z][a-z0-9+.-]*:|\/)/i;
/**
 * The location of the `eval` call inside a V8 frame for evaluated code:
 * `eval (eval at render (https://x/index.js:1:2), <anonymous>:1:1)`.
 */
const V8_EVAL_ORIGIN = /\((\S+:\d+)\)/;
/**
 * Firefox's marker for code created by `eval` or `new Function` inside a file.
 */
const FIREFOX_EVAL = / line \d+ > /;

/**
 * Whether `value` is a debug ID: 32 hex characters once lowercased and
 * stripped of hyphens.
 */
function isDebugId(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        NORMALISED_DEBUG_ID.test(value.toLowerCase().replace(/-/g, ''))
    );
}

/**
 * The `file:line:column` part of a V8 frame (Chrome, Node.js, Electron, Edge,
 * Deno, Bun), given the text after `at `.
 */
function getV8Location(frame: string): string | undefined {
    let location = frame;
    if (frame.endsWith(')')) {
        // "fn (location)". The first " (" ends the function name, so a path
        // with its own parentheses ("C:\Program Files (x86)\...") stays whole.
        const open = frame.indexOf(' (');
        if (open !== -1) {
            location = frame.slice(open + 2, -1);
        }
    }
    location = location.replace(/^async /, '');
    if (location.startsWith('eval at ')) {
        return undefined;
    }
    // Hermes prefixes bytecode locations: "address at index.android.bundle:1:2".
    return location.replace(/^address at /, '');
}

/**
 * The `file:line:column` part of a Firefox or Safari frame, `fn@location`.
 * Safari leaves the `@` out when the function has no name, and URLs can hold
 * an `@` of their own (`/npm/pkg@1.2.3/`, `/node_modules/@scope/`).
 */
function getGeckoLocation(frame: string): string {
    const at = frame.indexOf('@');
    if (at === -1 || FILE_START.test(frame.slice(0, at))) {
        return frame;
    }
    return frame.slice(at + 1);
}

/**
 * The file named by the first frame of a stack string, exactly as the engine
 * wrote it, or `undefined` when the first frame names no file. Later frames
 * are never used: they belong to whatever loaded the file.
 *
 * Handles `at fn (file:line:col)` and `at file:line:col` (V8), and
 * `fn@file:line:col`, `@file:line:col` and `file:line:col` (Firefox, Safari).
 */
export function getStackFile(stack: string): string | undefined {
    const lines = stack.split('\n');
    const v8Frame = lines.find((line) => V8_FRAME.test(line));

    let location: string | undefined;
    if (v8Frame !== undefined) {
        location = getV8Location(v8Frame.trim().slice(3));
    } else {
        const firstFrame = lines.find((line) => line.trim().length > 0);
        location =
            firstFrame === undefined
                ? undefined
                : getGeckoLocation(firstFrame.trim());
    }

    return getLocationFile(location);
}

/**
 * The file of a `file:line:column` location, or `undefined` when the location
 * names no file (`<anonymous>`, `[native code]`, Firefox `eval` code).
 */
function getLocationFile(location: string | undefined): string | undefined {
    const file = location?.match(LOCATION)?.[1];
    if (
        file === undefined ||
        file.startsWith('<') ||
        file.startsWith('[') ||
        FIREFOX_EVAL.test(file)
    ) {
        return undefined;
    }
    return file;
}

/**
 * The file each frame of a stack string names, in frame order. Frames that
 * name no file are left out, and so is everything that is not a frame: a V8
 * stack starts with the error's message, which can hold file names of its own.
 *
 * A V8 frame for code created by `eval` gives the file that called `eval`,
 * which is the file its position is reported against.
 */
function getFrameFiles(stack: string): string[] {
    const lines = stack.split('\n');
    const isV8 = lines.some((line) => V8_FRAME.test(line));

    const files: string[] = [];
    for (const line of lines) {
        const frame = line.trim();
        let location: string | undefined;
        if (!isV8) {
            location = frame.length > 0 ? getGeckoLocation(frame) : undefined;
        } else if (V8_FRAME.test(line)) {
            const text = frame.slice(3);
            location =
                getV8Location(text) ?? text.match(V8_EVAL_ORIGIN)?.[1];
        }

        const file = getLocationFile(location);
        if (file !== undefined) {
            files.push(file);
        }
    }
    return files;
}

/**
 * Parsed file for each key of `globalThis._debugIds` seen by the last
 * `getDebugIds()` call, so every stack string is parsed once.
 */
let fileByStack = new Map<string, string | undefined>();

/**
 * Reads `globalThis._debugIds`, the registry that scripts built with
 * `@bugsplat/build` (and some bundlers natively) fill as they load. Each key
 * is the stack string of an Error created in the registering script and each
 * value is that script's source map debug ID.
 *
 * Returns script file to debug ID, where the file is exactly as it appears in
 * stack frames and the ID is as the build wrote it. Entries whose stack names
 * no file, or whose value is not a debug ID, are left out. When a file
 * registered more than once, its latest registration wins.
 *
 * Never throws: a missing or unreadable registry gives an empty object.
 */
export function getDebugIds(): Record<string, string> {
    const debugIds: Record<string, string> = {};
    try {
        const registry = (globalThis as { _debugIds?: unknown })._debugIds;
        if (typeof registry !== 'object' || registry === null) {
            return debugIds;
        }

        const parsed = new Map<string, string | undefined>();
        for (const stack of Object.keys(registry)) {
            const file = fileByStack.has(stack)
                ? fileByStack.get(stack)
                : getStackFile(stack);
            parsed.set(stack, file);

            const debugId = (registry as Record<string, unknown>)[stack];
            if (file !== undefined && isDebugId(debugId)) {
                debugIds[file] = debugId;
            }
        }
        fileByStack = parsed;
    } catch {
        // A registry that throws when read gives whatever was read before it threw.
    }
    return debugIds;
}

/**
 * The debug IDs `post()` works from: those read from `globalThis._debugIds`,
 * overridden per file by the valid entries of `explicit`.
 */
export function collectDebugIds(
    explicit?: Record<string, string>,
): Record<string, string> {
    const debugIds = getDebugIds();
    try {
        if (typeof explicit === 'object' && explicit !== null) {
            for (const file of Object.keys(explicit)) {
                const debugId: unknown = explicit[file];
                if (file.length > 0 && isDebugId(debugId)) {
                    debugIds[file] = debugId;
                }
            }
        }
    } catch {
        // Keep what the registry gave.
    }
    return debugIds;
}

/**
 * The `debugMeta` list for a set of stacks: one row for each file of
 * `debugIds` that is the file of a frame in one of the stacks. A file that a
 * stack only mentions, in the error's message or as the end of a longer path,
 * gets no row.
 *
 * Rows are ordered by where the file first appears, the posted error's top
 * frame first, so that when the size cap leaves rows out from the end it
 * leaves out the files furthest from the crash.
 */
export function createDebugMeta(
    stacks: Array<string | undefined>,
    debugIds: Record<string, string>,
): BugSplatDebugMeta[] {
    const rows: BugSplatDebugMeta[] = [];
    try {
        const listed = new Set<string>();
        for (const stack of stacks) {
            if (typeof stack !== 'string') {
                continue;
            }
            for (const file of getFrameFiles(stack)) {
                if (
                    !listed.has(file) &&
                    Object.prototype.hasOwnProperty.call(debugIds, file)
                ) {
                    listed.add(file);
                    rows.push({ file, debugId: debugIds[file] });
                }
            }
        }
    } catch {
        return [];
    }
    return rows;
}
