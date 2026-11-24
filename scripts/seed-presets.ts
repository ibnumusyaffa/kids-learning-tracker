/**
 * Seeder preset (template materi) ke D1.
 *
 *   pnpm db:seed:presets          # D1 lokal
 *   pnpm db:seed:presets:remote   # D1 production
 *
 * Idempoten: aman dijalankan berkali-kali. Jalankan setelah migrasi.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PRESETS } from '../src/db/presets/index.ts'
import { buildPresetSql } from '../src/db/presets/sql.ts'

const DATABASE = 'kids-tracker'
const target = process.argv.includes('--remote') ? '--remote' : '--local'

const sql = buildPresetSql(PRESETS)
const dir = mkdtempSync(join(tmpdir(), 'kids-tracker-seed-'))
const file = join(dir, 'presets.sql')
writeFileSync(file, sql)

console.log(
  `Seeding ${PRESETS.length} preset (${PRESETS.map((p) => p.code).join(', ')}) → ${target.slice(2)}`,
)
try {
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DATABASE, target, '--file', file, '--yes'],
    { stdio: 'inherit' },
  )
} finally {
  rmSync(dir, { recursive: true, force: true })
}
