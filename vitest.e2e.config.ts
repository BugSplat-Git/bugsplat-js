import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        include: ['spec/**/*.e2e.spec.ts'],
        testTimeout: 30000,
    },
});




