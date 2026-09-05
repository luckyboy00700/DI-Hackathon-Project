import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Playwright owns tests/e2e; vitest must not try to collect those specs.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    // Integration/contract suites talk to a real local Postgres (constitution Principle II
    // forbids mocking the database), so they must not run concurrently against shared rows.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['tests/helpers/load-env.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/domain/**/*.ts'],
      thresholds: {
        // Hackathon Mode: 100% on age/eligibility and agreement generation (constitution
        // Delivery Constraints), plus endorsement signing as a project choice on top.
        'lib/domain/eligibility.ts': { lines: 100, functions: 100, statements: 100 },
        'lib/domain/agreement.ts': { lines: 100, functions: 100, statements: 100 },
        'lib/domain/endorsement.ts': { lines: 100, functions: 100, statements: 100 },
      },
    },
  },
});
