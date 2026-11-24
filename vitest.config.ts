import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Terpisah dari vite.config.ts supaya unit test tidak memuat plugin Cloudflare.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
