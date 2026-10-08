/**
 * One exception in the chain posted alongside `callstack`.
 *
 * Entry 0 is the error passed to `post()`. Later entries are discovered by
 * walking `Error.cause` and `AggregateError.errors` depth-first, `cause`
 * before `errors[]`, so a linked error's own chain stays contiguous.
 */
export interface BugSplatExceptionEntry {
    /**
     * 0 for the posted error, then discovery order.
     */
    id: number;
    /**
     * `null` for entry 0; otherwise the id of the entry this one was reached from.
     */
    parentId: number | null;
    /**
     * `null` for entry 0; `"cause"` or `"errors[<i>]"` for linked entries.
     */
    source: string | null;
    /**
     * `error.name`, falling back to the constructor name, then `"Error"`.
     * For a non-Error object: its constructor name, else `"Object"`.
     * For other non-Error values: `typeof value`.
     */
    type: string;
    /**
     * `error.message`. For a non-Error object: its `message` property when
     * that is a string, else `String(value)`. For other values: `String(value)`.
     */
    message: string;
    /**
     * Raw `error.stack` when present.
     */
    stack?: string;
    /**
     * Own enumerable properties serialized as JSON-safe values. For an Error,
     * `name`, `message`, `stack`, `cause` and `errors` are left out; for a
     * non-Error object only `message` is. Empty for primitives.
     */
    properties: Record<string, unknown>;
}

/**
 * Maximum number of linked entries beyond entry 0.
 */
export const MAX_LINKED_EXCEPTIONS = 5;
/**
 * Containers nested deeper than this inside `properties` become `[Object]` / `[Array]`.
 */
export const MAX_PROPERTY_DEPTH = 3;
/**
 * Strings inside `properties` longer than this are cut and suffixed with `…`.
 */
export const MAX_PROPERTY_STRING_LENGTH = 1024;
/**
 * Byte budget for each entry's serialized `properties`.
 */
export const MAX_PROPERTIES_BYTES = 8 * 1024;
/**
 * Byte budget for the whole serialized `exceptions` array.
 */
export const MAX_EXCEPTIONS_BYTES = 64 * 1024;
/**
 * Stacks are never truncated below this many characters by the total-size cap.
 */
export const MIN_STACK_LENGTH = 1024;
/**
 * Messages are never truncated below this many characters by the total-size cap.
 */
export const MIN_MESSAGE_LENGTH = 1024;

/**
 * Own properties of an Error that are lifted into entry fields or walked into
 * child entries, so they are left out of `properties`.
 */
const ERROR_ENTRY_FIELDS = new Set([
    'name',
    'message',
    'stack',
    'cause',
    'errors',
]);
/**
 * Own properties of a non-Error object that are lifted into entry fields.
 */
const OBJECT_ENTRY_FIELDS = new Set(['message']);
const SKIP = Symbol('skip');
const encoder =
    typeof TextEncoder !== 'undefined' ? new TextEncoder() : undefined;

function byteLength(text: string): number {
    return encoder ? encoder.encode(text).length : text.length;
}

function safeRead(target: object, key: string): unknown {
    try {
        return (target as Record<string, unknown>)[key];
    } catch {
        return undefined;
    }
}

function safeKeys(target: object): string[] {
    try {
        return Object.keys(target);
    } catch {
        return [];
    }
}

function toText(value: unknown): string {
    try {
        return String(value);
    } catch {
        return '';
    }
}

function isErrorLike(value: unknown): value is Error {
    if (value instanceof Error) {
        return true;
    }
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    if (Object.prototype.toString.call(value) === '[object Error]') {
        return true;
    }
    return (
        typeof safeRead(value, 'message') === 'string' &&
        typeof safeRead(value, 'stack') === 'string'
    );
}

function isDate(value: object): value is Date {
    return Object.prototype.toString.call(value) === '[object Date]';
}

function getType(error: Error): string {
    const name = safeRead(error, 'name');
    if (typeof name === 'string' && name.length > 0) {
        return name;
    }
    const constructor = safeRead(error, 'constructor');
    const constructorName =
        typeof constructor === 'function' ? constructor.name : undefined;
    if (typeof constructorName === 'string' && constructorName.length > 0) {
        return constructorName;
    }
    return 'Error';
}

function getMessage(error: Error): string {
    const message = safeRead(error, 'message');
    if (typeof message === 'string') {
        return message;
    }
    return message === undefined || message === null ? '' : toText(message);
}

function getStack(error: Error): string | undefined {
    const stack = safeRead(error, 'stack');
    return typeof stack === 'string' ? stack : undefined;
}

function truncateString(text: string): string {
    return text.length > MAX_PROPERTY_STRING_LENGTH
        ? `${text.slice(0, MAX_PROPERTY_STRING_LENGTH)}…`
        : text;
}

function serializeValue(value: unknown, depth: number): unknown {
    switch (typeof value) {
        case 'string':
            return truncateString(value);
        case 'number':
            return Number.isFinite(value) ? value : String(value);
        case 'boolean':
            return value;
        case 'bigint':
            return value.toString();
        case 'undefined':
        case 'symbol':
        case 'function':
            return SKIP;
    }
    if (value === null) {
        return null;
    }
    const object = value as object;
    if (isDate(object)) {
        try {
            return object.toISOString();
        } catch {
            return toText(object);
        }
    }
    if (isErrorLike(object)) {
        return getMessage(object);
    }
    if (ArrayBuffer.isView(object)) {
        return `[${getType(object as unknown as Error)}]`;
    }
    if (Array.isArray(object)) {
        if (depth > MAX_PROPERTY_DEPTH) {
            return '[Array]';
        }
        const items: unknown[] = [];
        for (let i = 0; i < object.length; i++) {
            const item = serializeValue(safeRead(object, String(i)), depth + 1);
            if (item !== SKIP) {
                items.push(item);
            }
        }
        return items;
    }
    if (depth > MAX_PROPERTY_DEPTH) {
        return '[Object]';
    }
    return serializeObject(object, depth);
}

function serializeObject(
    object: object,
    depth: number,
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of safeKeys(object)) {
        const serialized = serializeValue(safeRead(object, key), depth + 1);
        if (serialized !== SKIP) {
            result[key] = serialized;
        }
    }
    return result;
}

function serializedSize(value: unknown): number {
    return byteLength(JSON.stringify(value));
}

/**
 * Drop the largest properties until the serialized object fits the per-entry budget.
 */
function capProperties(
    properties: Record<string, unknown>,
): Record<string, unknown> {
    const capped = { ...properties };
    while (serializedSize(capped) > MAX_PROPERTIES_BYTES) {
        const keys = Object.keys(capped);
        if (keys.length === 0) {
            break;
        }
        const largest = keys.reduce((a, b) =>
            serializedSize(capped[b]) > serializedSize(capped[a]) ? b : a,
        );
        delete capped[largest];
    }
    return capped;
}

function serializeProperties(
    target: object,
    entryFields: Set<string>,
): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const key of safeKeys(target)) {
        if (entryFields.has(key)) {
            continue;
        }
        const serialized = serializeValue(safeRead(target, key), 1);
        if (serialized !== SKIP) {
            properties[key] = serialized;
        }
    }
    return capProperties(properties);
}

function createErrorEntry(
    error: Error,
    id: number,
    parentId: number | null,
    source: string | null,
): BugSplatExceptionEntry {
    const entry: BugSplatExceptionEntry = {
        id,
        parentId,
        source,
        type: getType(error),
        message: getMessage(error),
        properties: {},
    };
    const stack = getStack(error);
    if (stack !== undefined) {
        entry.stack = stack;
    }
    entry.properties = serializeProperties(error, ERROR_ENTRY_FIELDS);
    return entry;
}

function getObjectType(object: object): string {
    const constructor = safeRead(object, 'constructor');
    const constructorName =
        typeof constructor === 'function' ? constructor.name : undefined;
    return typeof constructorName === 'string' && constructorName.length > 0
        ? constructorName
        : 'Object';
}

function createObjectEntry(
    object: object,
    id: number,
    parentId: number | null,
    source: string | null,
): BugSplatExceptionEntry {
    const message = safeRead(object, 'message');
    return {
        id,
        parentId,
        source,
        type: getObjectType(object),
        message: typeof message === 'string' ? message : toText(object),
        properties: serializeProperties(object, OBJECT_ENTRY_FIELDS),
    };
}

function createValueEntry(
    value: unknown,
    id: number,
    parentId: number | null,
    source: string | null,
): BugSplatExceptionEntry {
    if (typeof value === 'object' && value !== null) {
        return createObjectEntry(value, id, parentId, source);
    }
    return {
        id,
        parentId,
        source,
        type: typeof value,
        message: toText(value),
        properties: {},
    };
}

function createEntry(
    value: unknown,
    id: number,
    parentId: number | null,
    source: string | null,
): BugSplatExceptionEntry {
    return isErrorLike(value)
        ? createErrorEntry(value, id, parentId, source)
        : createValueEntry(value, id, parentId, source);
}

function depthOf(
    entry: BugSplatExceptionEntry,
    entries: BugSplatExceptionEntry[],
): number {
    let depth = 0;
    let parentId = entry.parentId;
    while (parentId !== null) {
        depth++;
        parentId = entries[parentId].parentId;
    }
    return depth;
}

const fitsBudget = (entries: BugSplatExceptionEntry[]): boolean =>
    serializedSize(entries) <= MAX_EXCEPTIONS_BYTES;

/**
 * Halve the longest `field` across entries, never below `floor` characters
 * (plus the `…` suffix), until the array fits the total budget or no field
 * is left to shrink. Returns whether the array now fits.
 */
function shrinkLongest(
    entries: BugSplatExceptionEntry[],
    field: 'stack' | 'message',
    floor: number,
): boolean {
    for (;;) {
        const longest = entries
            .filter((entry) => (entry[field]?.length ?? 0) > floor + 1)
            .sort((a, b) => b[field]!.length - a[field]!.length)[0];
        if (!longest) {
            return false;
        }
        const length = Math.max(floor, Math.floor(longest[field]!.length / 2));
        longest[field] = `${longest[field]!.slice(0, length)}…`;
        if (fitsBudget(entries)) {
            return true;
        }
    }
}

/**
 * Bring the whole array under the total budget: drop `properties` from the
 * deepest entries first, then shorten the longest stacks, then the longest
 * messages. Entries are never dropped.
 */
function capTotalSize(
    entries: BugSplatExceptionEntry[],
): BugSplatExceptionEntry[] {
    if (fitsBudget(entries)) {
        return entries;
    }

    const deepestFirst = [...entries].sort(
        (a, b) => depthOf(b, entries) - depthOf(a, entries) || b.id - a.id,
    );
    for (const entry of deepestFirst) {
        if (Object.keys(entry.properties).length === 0) {
            continue;
        }
        entry.properties = {};
        if (fitsBudget(entries)) {
            return entries;
        }
    }

    if (shrinkLongest(entries, 'stack', MIN_STACK_LENGTH)) {
        return entries;
    }
    shrinkLongest(entries, 'message', MIN_MESSAGE_LENGTH);
    return entries;
}

/**
 * Build the structured exception chain for an error: the error itself as
 * entry 0, followed by everything reachable through `cause` and
 * `AggregateError.errors` (at most `MAX_LINKED_EXCEPTIONS` linked entries,
 * cycles skipped). Non-Error values in the chain become a single entry and are
 * not walked further: objects keep their own properties, primitives get
 * `type = typeof value`.
 *
 * Never throws: on an unexpected failure it returns entry 0 alone.
 */
export function createExceptionChain(error: unknown): BugSplatExceptionEntry[] {
    const root = createEntry(error, 0, null, null);
    const entries: BugSplatExceptionEntry[] = [root];
    const visited = new Set<object>();

    const link = (value: unknown, parentId: number, source: string): void => {
        if (entries.length > MAX_LINKED_EXCEPTIONS) {
            return;
        }
        if (!isErrorLike(value)) {
            entries.push(
                createValueEntry(value, entries.length, parentId, source),
            );
            return;
        }
        if (visited.has(value)) {
            return;
        }
        visited.add(value);
        const entry = createErrorEntry(value, entries.length, parentId, source);
        entries.push(entry);
        walk(value, entry.id);
    };

    const walk = (error: Error, id: number): void => {
        const cause = safeRead(error, 'cause');
        if (cause !== undefined && cause !== null) {
            link(cause, id, 'cause');
        }
        const errors = safeRead(error, 'errors');
        if (Array.isArray(errors)) {
            for (
                let i = 0;
                i < errors.length && entries.length <= MAX_LINKED_EXCEPTIONS;
                i++
            ) {
                const element = safeRead(errors, String(i));
                if (element !== undefined && element !== null) {
                    link(element, id, `errors[${i}]`);
                }
            }
        }
    };

    try {
        if (isErrorLike(error)) {
            visited.add(error);
            walk(error, 0);
        }
        return capTotalSize(entries);
    } catch {
        return [root];
    }
}
