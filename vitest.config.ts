import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "./*" path alias (project root).
      '@': resolve(__dirname, '.'),
      // Next.js-only marker packages have no runtime under Vitest; stub them so
      // server modules (which `import "server-only"`) can be imported in tests.
      'server-only': resolve(__dirname, 'tests/empty-module.ts'),
      'client-only': resolve(__dirname, 'tests/empty-module.ts'),
    },
  },
})
