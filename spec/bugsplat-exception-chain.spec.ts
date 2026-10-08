import { describe, it, expect } from 'vitest';
import {
    createExceptionChain,
    MAX_EXCEPTIONS_BYTES,
    MAX_LINKED_EXCEPTIONS,
    MAX_PROPERTIES_BYTES,
    MAX_PROPERTY_STRING_LENGTH,
    MIN_MESSAGE_LENGTH,
    MIN_STACK_LENGTH,
} from '../src/bugsplat-exception-chain';

const byteLength = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).length;

describe('createExceptionChain', () => {
    describe('entry 0', () => {
        it('describes a plain Error', () => {
            const error = new Error('BugSplat!');

            const [entry, ...rest] = createExceptionChain(error);

            expect(rest).toEqual([]);
            expect(entry).toEqual({
                id: 0,
                parentId: null,
                source: null,
                type: 'Error',
                message: 'BugSplat!',
                stack: error.stack,
                properties: {},
            });
        });

        it('uses error.name as the type', () => {
            expect(createExceptionChain(new TypeError('nope'))[0].type).toBe(
                'TypeError',
            );
            expect(createExceptionChain(new RangeError('nope'))[0].type).toBe(
                'RangeError',
            );
        });

        it('falls back to the constructor name, then "Error", when name is empty', () => {
            class DatabaseError extends Error {}
            const named = new DatabaseError('conflict');
            named.name = '';
            expect(createExceptionChain(named)[0].type).toBe('DatabaseError');

            const anonymous = {
                message: 'duck',
                stack: 'duck stack',
                name: '',
            };
            Object.setPrototypeOf(anonymous, Object.create(null));
            expect(createExceptionChain(anonymous)[0].type).toBe('Error');
        });

        it('includes custom own properties and excludes name, message, stack, cause and errors', () => {
            const error = Object.assign(new Error('duplicate key'), {
                code: '23505',
                constraint_name: 'users_email_key',
                severity: 'ERROR',
                cause: new Error('inner'),
                errors: [new Error('aggregate')],
            });
            error.name = 'PostgresError';

            const [entry] = createExceptionChain(error);

            expect(entry.properties).toEqual({
                code: '23505',
                constraint_name: 'users_email_key',
                severity: 'ERROR',
            });
            expect(Object.keys(entry.properties)).not.toContain('name');
            expect(Object.keys(entry.properties)).not.toContain('message');
            expect(Object.keys(entry.properties)).not.toContain('stack');
            expect(Object.keys(entry.properties)).not.toContain('cause');
            expect(Object.keys(entry.properties)).not.toContain('errors');
        });

        it('omits stack when the error has none', () => {
            const error = new Error('no stack');
            delete error.stack;

            const [entry] = createExceptionChain(error);

            expect('stack' in entry).toBe(false);
        });

        it('does not call toJSON on the error', () => {
            const error = Object.assign(new Error('BugSplat!'), {
                toJSON: () => {
                    throw new Error('toJSON must not be called');
                },
            });

            expect(() => createExceptionChain(error)).not.toThrow();
            expect(() =>
                JSON.stringify(createExceptionChain(error)),
            ).not.toThrow();
        });

        it('describes a non-Error root as a value entry', () => {
            expect(createExceptionChain('just a string')).toEqual([
                {
                    id: 0,
                    parentId: null,
                    source: null,
                    type: 'string',
                    message: 'just a string',
                    properties: {},
                },
            ]);
        });
    });

    describe('cause chain', () => {
        it('walks a chain of 3 causes with sequential ids and parent links', () => {
            const innermost = new Error('connection refused');
            const middle = new Error('query failed', { cause: innermost });
            const outer = new Error('request failed', { cause: middle });
            const root = new Error('handler failed', { cause: outer });

            const chain = createExceptionChain(root);

            expect(
                chain.map(({ id, parentId, source, message }) => ({
                    id,
                    parentId,
                    source,
                    message,
                })),
            ).toEqual([
                {
                    id: 0,
                    parentId: null,
                    source: null,
                    message: 'handler failed',
                },
                {
                    id: 1,
                    parentId: 0,
                    source: 'cause',
                    message: 'request failed',
                },
                {
                    id: 2,
                    parentId: 1,
                    source: 'cause',
                    message: 'query failed',
                },
                {
                    id: 3,
                    parentId: 2,
                    source: 'cause',
                    message: 'connection refused',
                },
            ]);
            expect(chain[3].stack).toBe(innermost.stack);
        });

        it('captures at most 5 linked entries beyond entry 0', () => {
            let error = new Error('depth 10');
            for (let i = 9; i >= 0; i--) {
                error = new Error(`depth ${i}`, { cause: error });
            }

            const chain = createExceptionChain(error);

            expect(chain).toHaveLength(MAX_LINKED_EXCEPTIONS + 1);
            expect(chain.map(({ message }) => message)).toEqual([
                'depth 0',
                'depth 1',
                'depth 2',
                'depth 3',
                'depth 4',
                'depth 5',
            ]);
        });

        it('terminates on a cycle', () => {
            const a = new Error('a');
            const b = new Error('b', { cause: a });
            a.cause = b;

            const chain = createExceptionChain(a);

            expect(
                chain.map(({ id, parentId, message }) => ({
                    id,
                    parentId,
                    message,
                })),
            ).toEqual([
                { id: 0, parentId: null, message: 'a' },
                { id: 1, parentId: 0, message: 'b' },
            ]);
        });

        it('handles a self-referencing cause', () => {
            const error = new Error('self');
            error.cause = error;

            expect(createExceptionChain(error)).toHaveLength(1);
        });

        it('ignores null and undefined causes', () => {
            expect(
                createExceptionChain(new Error('x', { cause: null })),
            ).toHaveLength(1);
            expect(
                createExceptionChain(new Error('x', { cause: undefined })),
            ).toHaveLength(1);
        });
    });

    describe('AggregateError', () => {
        it('links each element as errors[i] and keeps walking their causes', () => {
            const nested = new Error('dns lookup failed');
            const first = new Error('fetch a failed', { cause: nested });
            const second = new Error('fetch b failed');
            const aggregate = new AggregateError(
                [first, second],
                'all fetches failed',
            );

            const chain = createExceptionChain(aggregate);

            expect(
                chain.map(({ id, parentId, source, type, message }) => ({
                    id,
                    parentId,
                    source,
                    type,
                    message,
                })),
            ).toEqual([
                {
                    id: 0,
                    parentId: null,
                    source: null,
                    type: 'AggregateError',
                    message: 'all fetches failed',
                },
                {
                    id: 1,
                    parentId: 0,
                    source: 'errors[0]',
                    type: 'Error',
                    message: 'fetch a failed',
                },
                {
                    id: 2,
                    parentId: 1,
                    source: 'cause',
                    type: 'Error',
                    message: 'dns lookup failed',
                },
                {
                    id: 3,
                    parentId: 0,
                    source: 'errors[1]',
                    type: 'Error',
                    message: 'fetch b failed',
                },
            ]);
            expect(chain[0].properties).toEqual({});
        });

        it('walks cause before errors', () => {
            const aggregate = new AggregateError(
                [new Error('child')],
                'aggregate',
                {
                    cause: new Error('the cause'),
                },
            );

            const chain = createExceptionChain(aggregate);

            expect(chain.map(({ source }) => source)).toEqual([
                null,
                'cause',
                'errors[0]',
            ]);
        });

        it('stops at the linked-entry cap across siblings', () => {
            const errors = Array.from(
                { length: 10 },
                (_, i) => new Error(`child ${i}`),
            );

            const chain = createExceptionChain(
                new AggregateError(errors, 'many'),
            );

            expect(chain).toHaveLength(MAX_LINKED_EXCEPTIONS + 1);
            expect(chain[MAX_LINKED_EXCEPTIONS].source).toBe('errors[4]');
        });

        it('does not repeat an error that appears both as cause and in errors', () => {
            const shared = new Error('shared');
            const aggregate = new AggregateError([shared], 'aggregate', {
                cause: shared,
            });

            const chain = createExceptionChain(aggregate);

            expect(chain.map(({ source }) => source)).toEqual([null, 'cause']);
        });
    });

    describe('non-Error causes', () => {
        it('records a string cause as a value entry and does not walk it', () => {
            const chain = createExceptionChain(
                new Error('wrapped', { cause: 'ECONNRESET' }),
            );

            expect(chain[1]).toEqual({
                id: 1,
                parentId: 0,
                source: 'cause',
                type: 'string',
                message: 'ECONNRESET',
                properties: {},
            });
        });

        it('keeps the properties of a plain object cause and does not walk it', () => {
            const cause = {
                code: 'E_PLAIN',
                cause: new Error('should not be walked'),
            };

            const chain = createExceptionChain(new Error('wrapped', { cause }));

            expect(chain).toHaveLength(2);
            expect(chain[1]).toEqual({
                id: 1,
                parentId: 0,
                source: 'cause',
                type: 'Object',
                message: '[object Object]',
                properties: { code: 'E_PLAIN', cause: 'should not be walked' },
            });
        });

        it("lifts a plain object cause's string message into the entry", () => {
            const cause = { code: 'ECONNRESET', message: 'socket hang up' };

            const chain = createExceptionChain(
                new Error('request failed', { cause }),
            );

            expect(chain[1]).toEqual({
                id: 1,
                parentId: 0,
                source: 'cause',
                type: 'Object',
                message: 'socket hang up',
                properties: { code: 'ECONNRESET' },
            });
        });

        it('uses the constructor name of a non-Error object cause, falling back to "Object"', () => {
            class SocketClosed {
                code = 'CLOSED';
            }
            const nullPrototype = Object.assign(Object.create(null), {
                code: 'NULL',
            });

            const chain = createExceptionChain(
                new AggregateError(
                    [new SocketClosed(), nullPrototype],
                    'any failed',
                ),
            );

            expect(chain[1]).toMatchObject({
                type: 'SocketClosed',
                properties: { code: 'CLOSED' },
            });
            expect(chain[2]).toMatchObject({
                type: 'Object',
                message: '',
                properties: { code: 'NULL' },
            });
        });

        it('records non-Error elements of errors[] as value entries', () => {
            const chain = createExceptionChain(
                new AggregateError(['timeout', 42], 'any failed'),
            );

            expect(chain.slice(1)).toEqual([
                {
                    id: 1,
                    parentId: 0,
                    source: 'errors[0]',
                    type: 'string',
                    message: 'timeout',
                    properties: {},
                },
                {
                    id: 2,
                    parentId: 0,
                    source: 'errors[1]',
                    type: 'number',
                    message: '42',
                    properties: {},
                },
            ]);
        });

        it('treats a duck-typed error (message + stack) as an Error', () => {
            const cause = {
                name: 'RemoteError',
                message: 'from a worker',
                stack: 'RemoteError: from a worker\n    at x',
                code: 7,
            };

            const chain = createExceptionChain(new Error('wrapped', { cause }));

            expect(chain[1]).toMatchObject({
                type: 'RemoteError',
                message: 'from a worker',
                stack: cause.stack,
                properties: { code: 7 },
            });
        });
    });

    describe('property serialization', () => {
        const propertiesOf = (props: Record<string, unknown>) =>
            createExceptionChain(Object.assign(new Error('x'), props))[0]
                .properties;

        it('keeps JSON-safe primitives and null', () => {
            expect(
                propertiesOf({ s: 'str', n: 1.5, b: false, z: null }),
            ).toEqual({
                s: 'str',
                n: 1.5,
                b: false,
                z: null,
            });
        });

        it('replaces containers nested deeper than 3 levels', () => {
            const properties = propertiesOf({
                a: { b: { c: { d: { e: 1 } } } },
                list: [[[[1]]]],
                shallow: { b: { c: 'leaf' } },
            });

            expect(properties).toEqual({
                a: { b: { c: { d: '[Object]' } } },
                list: [[['[Array]']]],
                shallow: { b: { c: 'leaf' } },
            });
        });

        it('caps strings with an ellipsis', () => {
            const long = 'x'.repeat(MAX_PROPERTY_STRING_LENGTH + 100);

            const { long: capped, nested } = propertiesOf({
                long,
                nested: { inner: long },
            });

            expect(capped).toBe(`${'x'.repeat(MAX_PROPERTY_STRING_LENGTH)}…`);
            expect((nested as { inner: string }).inner).toHaveLength(
                MAX_PROPERTY_STRING_LENGTH + 1,
            );
            expect(
                propertiesOf({ exact: 'y'.repeat(MAX_PROPERTY_STRING_LENGTH) })
                    .exact,
            ).toHaveLength(MAX_PROPERTY_STRING_LENGTH);
        });

        it('converts bigint, Date and Error values and skips functions, symbols and undefined', () => {
            const when = new Date('2026-10-08T12:34:56.000Z');

            const properties = propertiesOf({
                big: 123n,
                when,
                invalid: new Date('nope'),
                inner: new TypeError('inner message'),
                fn: () => 'nope',
                sym: Symbol('nope'),
                missing: undefined,
                nan: NaN,
                list: [1, () => 2, undefined, 3n],
            });

            expect(properties).toEqual({
                big: '123',
                when: '2026-10-08T12:34:56.000Z',
                invalid: 'Invalid Date',
                inner: 'inner message',
                nan: 'NaN',
                list: [1, '3'],
            });
        });

        it('summarizes binary views instead of enumerating their bytes', () => {
            expect(propertiesOf({ buffer: new Uint8Array(4096) })).toEqual({
                buffer: '[Uint8Array]',
            });
        });

        it('skips a property whose getter throws', () => {
            const error = new Error('x');
            Object.defineProperty(error, 'bad', {
                enumerable: true,
                get() {
                    throw new Error('nope');
                },
            });
            Object.defineProperty(error, 'good', {
                enumerable: true,
                value: 'ok',
            });

            expect(createExceptionChain(error)[0].properties).toEqual({
                good: 'ok',
            });
        });

        it('drops the largest properties until an entry fits the 8 KB budget', () => {
            const filler = (size: number) =>
                Array.from({ length: size }, (_, i) => i);
            const properties = propertiesOf({
                code: '23505',
                big: filler(3000),
                bigger: filler(4000),
                constraint: 'users_email_key',
            });

            expect(byteLength(properties)).toBeLessThanOrEqual(
                MAX_PROPERTIES_BYTES,
            );
            expect(Object.keys(properties)).toEqual(['code', 'constraint']);
        });

        it('keeps the keys when the entry fits the 8 KB budget', () => {
            const properties = propertiesOf({
                a: 'x'.repeat(1000),
                b: 'y'.repeat(1000),
                c: 'z'.repeat(1000),
            });
            expect(Object.keys(properties)).toEqual(['a', 'b', 'c']);
        });
    });

    describe('total size cap', () => {
        const kilobytesOfProperties = () =>
            Object.fromEntries(
                Array.from({ length: 7 }, (_, i) => [
                    `k${i}`,
                    'p'.repeat(1000),
                ]),
            );

        it('drops properties from the deepest entries first, never entries', () => {
            // Six entries at ~7 KB each of properties: ~42 KB. A 30 KB stack on
            // entry 0 pushes the total over 64 KB without properties being the
            // sole culprit, so the deepest entries lose theirs first.
            let error = Object.assign(
                new Error('depth 5'),
                kilobytesOfProperties(),
            );
            for (let i = 4; i >= 0; i--) {
                error = Object.assign(
                    new Error(`depth ${i}`, { cause: error }),
                    kilobytesOfProperties(),
                );
            }
            error.stack = `Error: depth 0\n${'    at frame\n'.repeat(2000)}`;

            const chain = createExceptionChain(error);

            expect(chain).toHaveLength(6);
            expect(byteLength(chain)).toBeLessThanOrEqual(MAX_EXCEPTIONS_BYTES);
            expect(chain[5].properties).toEqual({});
            expect(chain[4].properties).toEqual({});
            expect(chain[0].properties).not.toEqual({});
            expect(chain[0].stack).toBe(error.stack);
        });

        it('truncates stacks only after all properties are gone, never below the floor', () => {
            const hugeStack = `Error: root\n${'    at frame\n'.repeat(10000)}`;
            const cause = Object.assign(new Error('cause'), { detail: 'd' });
            cause.stack = hugeStack;
            const error = Object.assign(new Error('root', { cause }), {
                code: 'c',
            });
            error.stack = hugeStack;

            const chain = createExceptionChain(error);

            expect(byteLength(chain)).toBeLessThanOrEqual(MAX_EXCEPTIONS_BYTES);
            expect(chain[0].properties).toEqual({});
            expect(chain[1].properties).toEqual({});
            expect(chain[0].stack!.length).toBeLessThan(hugeStack.length);
            expect(chain[0].stack!.endsWith('…')).toBe(true);
            expect(chain[0].stack!.length).toBeGreaterThanOrEqual(
                MIN_STACK_LENGTH,
            );
            expect(chain[1].stack!.length).toBeGreaterThanOrEqual(
                MIN_STACK_LENGTH,
            );
        });

        it('truncates the longest messages last, so a 200 KB message cannot sink the payload', () => {
            const huge = 'm'.repeat(200 * 1024);
            const cause = new Error('connection refused');
            const error = new Error(huge, { cause });

            const chain = createExceptionChain(error);

            expect(chain).toHaveLength(2);
            expect(byteLength(chain)).toBeLessThanOrEqual(MAX_EXCEPTIONS_BYTES);
            expect(chain[0].message.endsWith('…')).toBe(true);
            expect(chain[0].message.length).toBeGreaterThanOrEqual(
                MIN_MESSAGE_LENGTH,
            );
            expect(chain[0].message.length).toBeLessThan(huge.length);
            expect(chain[1].message).toBe('connection refused');
            // Stacks are exhausted down to their floor before messages are touched.
            expect(chain[1].stack!.length).toBeGreaterThanOrEqual(
                MIN_STACK_LENGTH,
            );
            expect(
                cause.stack!.startsWith(chain[1].stack!.replace(/…$/, '')),
            ).toBe(true);
        });

        it('leaves a small chain untouched', () => {
            const cause = Object.assign(new Error('cause'), {
                code: 'ECONNRESET',
            });
            const error = Object.assign(new Error('root', { cause }), {
                status: 502,
            });

            const chain = createExceptionChain(error);

            expect(chain[0].properties).toEqual({ status: 502 });
            expect(chain[1].properties).toEqual({ code: 'ECONNRESET' });
            expect(chain[0].stack).toBe(error.stack);
        });
    });

    describe('robustness', () => {
        it('still returns entry 0 when the cause getter throws', () => {
            const error = new Error('x');
            Object.defineProperty(error, 'cause', {
                get() {
                    throw new Error('nope');
                },
            });

            const chain = createExceptionChain(error);

            expect(chain).toHaveLength(1);
            expect(chain[0].message).toBe('x');
        });

        it('tolerates a Proxy that throws on ownKeys', () => {
            const hostile = new Proxy(new Error('hostile'), {
                ownKeys() {
                    throw new Error('no keys for you');
                },
            });

            const chain = createExceptionChain(
                new Error('wrapped', { cause: hostile }),
            );

            expect(chain).toHaveLength(2);
            expect(chain[1].properties).toEqual({});
        });

        it('produces JSON that round-trips', () => {
            const error = Object.assign(
                new Error('root', { cause: new Error('cause') }),
                {
                    big: 1n,
                    when: new Date(0),
                },
            );

            const chain = createExceptionChain(error);

            expect(JSON.parse(JSON.stringify(chain))).toEqual(chain);
        });
    });
});
