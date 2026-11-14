import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type ExportTarget = string | { [condition: string]: ExportTarget };

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
    exports: Record<string, ExportTarget>;
};

// Mirrors how Node, bundlers and test runners walk an exports map: keys are
// tried in the order they appear and the first one in the resolver's
// condition set wins, with "default" always matching.
function resolveConditions(target: ExportTarget, conditions: ReadonlySet<string>): string | undefined {
    if (typeof target === 'string') {
        return target;
    }

    for (const [condition, next] of Object.entries(target)) {
        if (condition === 'default' || conditions.has(condition)) {
            const resolved = resolveConditions(next, conditions);
            if (resolved) {
                return resolved;
            }
        }
    }

    return undefined;
}

const cjs = /^\.\/dist\/cjs\/.*\.js$/;
const esm = /^\.\/dist\/esm\/.*\.js$/;
const types = /^\.\/dist\/esm\/.*\.d\.ts$/;

// The ESM build is not loadable by Node (no "type": "module", .js extension),
// so Node, Bun and Jest must get the CJS build. Bundlers that advertise
// "module" get ESM, and so do browser-targeting resolvers handling an ESM
// import: Angular CLI drops "module" (its builder receives conditions: [],
// which replaces the default list), leaving only "browser" + "import".
// Jest with jsdom also sets "browser" but resolves through "require", so it
// still gets CJS.
const resolvers: Array<{ name: string; conditions: string[]; expected: RegExp }> = [
    { name: 'Node require()', conditions: ['node', 'require'], expected: cjs },
    { name: 'Node import', conditions: ['node', 'import'], expected: cjs },
    { name: 'Bun', conditions: ['bun', 'node', 'import'], expected: cjs },
    { name: 'Jest with jest-environment-node', conditions: ['node', 'require'], expected: cjs },
    { name: 'Jest with jsdom (jest-expo/web)', conditions: ['browser', 'require'], expected: cjs },
    { name: 'Metro for Expo web', conditions: ['browser', 'require', 'import', 'react-native'], expected: esm },
    { name: 'Vite', conditions: ['module', 'browser', 'import'], expected: esm },
    { name: 'webpack 5 web target', conditions: ['webpack', 'browser', 'module', 'import'], expected: esm },
    { name: 'esbuild browser platform', conditions: ['browser', 'module', 'import'], expected: esm },
    { name: 'Angular CLI (esbuild, no "module")', conditions: ['es2015', 'es2020', 'browser', 'import'], expected: esm },
    { name: 'Angular CLI require()', conditions: ['es2015', 'es2020', 'browser', 'require'], expected: cjs },
    { name: 'TypeScript', conditions: ['types', 'import'], expected: types },
];

describe('package.json exports', () => {
    for (const subpath of ['.', './node']) {
        describe(subpath, () => {
            for (const { name, conditions, expected } of resolvers) {
                it(`gives ${name} ${expected === cjs ? 'the CJS build' : expected === esm ? 'the ESM build' : 'the type declarations'}`, () => {
                    const resolved = resolveConditions(pkg.exports[subpath], new Set(conditions));
                    expect(resolved).toMatch(expected);
                });
            }
        });
    }

    it('keeps the ./node declarations next to the ./node build', () => {
        const target = pkg.exports['./node'] as Record<string, string>;
        expect(target.types).toBe('./dist/esm/node/index.d.ts');
        expect(target.require).toBe('./dist/cjs/node/index.js');
    });
});
