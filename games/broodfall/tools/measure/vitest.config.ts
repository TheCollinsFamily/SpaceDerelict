/**
 * MEASURING, not testing: `npx vitest run --config tools/measure/vitest.config.ts`.
 * The files here are not part of `npm test`: they take minutes and they assert nothing.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tools/measure/*.measure.ts'], testTimeout: 3_600_000, hookTimeout: 3_600_000 },
});
