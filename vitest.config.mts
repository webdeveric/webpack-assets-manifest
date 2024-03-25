import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./test/**/*.test.ts'],
    coverage: {
      all: false,
      provider: 'v8',
      reporter: ['json', 'html'],
    },
  },
});
