import { defineConfig } from 'drizzle-kit'

// Migrasi di-generate oleh drizzle-kit lalu di-apply oleh wrangler:
//   pnpm db:generate
//   pnpm db:migrate:local   (atau db:migrate:remote)
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
