import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        include: ['spec/**/*.spec.ts'],
        exclude: ['spec/**/*.e2e.spec.ts'],
    },
});




