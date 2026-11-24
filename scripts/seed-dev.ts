/**
 * Data contoh untuk development (HANYA D1 lokal).
 *
 *   pnpm db:seed:dev
 *
 * Login: demo@kids.test / password123
 *
 * Isi: Keluarga Demo dengan 2 anak, 5 pelajaran, dan ±8 minggu log. Aman diulang: data demo lama dihapus dulu (semua id
 * berawalan `dev_`). Angka (mis. halaman Iqra) hanyalah contoh.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hashPassword } from 'better-auth/crypto'
import { quranJuz30 } from '../src/db/presets/quran-juz30.ts'
import { presetId } from '../src/db/presets/sql.ts'

if (process.argv.includes('--remote')) {
  console.error('seed-dev hanya untuk D1 lokal.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

const TZ = 'Asia/Jakarta'
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const day = (offset: number) => {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
/** Waktu kejadian (ms) untuk tanggal lokal + jam WIB. */
const at = (date: string, hour = 18, minute = 0) =>
  Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`)

// PRNG deterministik supaya data sama setiap kali di-seed.
let seed = 20261123
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (Array.isArray(v)) return q(JSON.stringify(v))
  return `'${String(v).replaceAll("'", "''")}'`
}
const sql: string[] = []
const insert = (table: string, row: Record<string, unknown>) => {
  const cols = Object.keys(row)
  sql.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => q(row[c])).join(', ')});`)
}

let counter = 0
const id = (prefix: string) => `dev_${prefix}_${String(++counter).padStart(4, '0')}`

// ---------------------------------------------------------------------------
// Bersihkan data demo lama (FK cascade dari organization & user)
// ---------------------------------------------------------------------------

sql.push(`DELETE FROM organization WHERE id = 'dev_family';`)
sql.push(`DELETE FROM user WHERE id = 'dev_user';`)

// ---------------------------------------------------------------------------
// Akun & keluarga
// ---------------------------------------------------------------------------

const USER = 'dev_user'
const FAMILY = 'dev_family'
const created = at(day(-60), 8)
insert('user', { id: USER, name: 'Ayah Demo', email: 'demo@kids.test', email_verified: 1, created_at: created, updated_at: created })
insert('account', { id: 'dev_account', account_id: USER, provider_id: 'credential', user_id: USER, password: await hashPassword('password123'), created_at: created, updated_at: created })
insert('organization', { id: FAMILY, name: 'Keluarga Demo', slug: 'dev-demo', created_at: created, timezone: TZ })
insert('member', { id: 'dev_member', organization_id: FAMILY, user_id: USER, role: 'owner', created_at: created })

const CAT = { quran: 'dev_cat_quran', sekolah: 'dev_cat_sekolah', kebiasaan: 'dev_cat_kebiasaan' }
insert('categories', { id: CAT.quran, family_id: FAMILY, name: 'Quran', color: 'green', sort_order: 0 })
insert('categories', { id: CAT.sekolah, family_id: FAMILY, name: 'Sekolah', color: 'blue', sort_order: 1 })
insert('categories', { id: CAT.kebiasaan, family_id: FAMILY, name: 'Kebiasaan', color: 'orange', sort_order: 2 })

const AISYAH = 'dev_child_aisyah'
const UMAR = 'dev_child_umar'
insert('children', { id: AISYAH, family_id: FAMILY, name: 'Aisyah', birth_date: '2018-03-14', grade: 'SD 2', avatar: '🦋', created_at: created })
insert('children', { id: UMAR, family_id: FAMILY, name: 'Umar', birth_date: '2021-07-02', grade: 'TK B', avatar: '🦁', created_at: created + 1 })

// ---------------------------------------------------------------------------
// Pelajaran & materi
// ---------------------------------------------------------------------------

type Unit = { id: string; label: string; size: number | null; parentId?: string; meaning?: string; tags?: string[]; mastery?: string | null; sortOrder: number }
const unitsBySubject = new Map<string, Unit[]>()

function subject(row: { id: string; child: string; category: string; name: string; structure: string; unitLabel?: string; openEnded?: boolean; suggestOrder?: string; preset?: string; order: number }) {
  insert('subjects', {
    id: row.id, child_id: row.child, category_id: row.category, preset_id: row.preset ?? null,
    name: row.name, structure: row.structure, unit_label: row.unitLabel ?? null,
    open_ended: row.openEnded ?? false, current_cycle: 1, suggest_order: row.suggestOrder ?? 'asc',
    sort_order: row.order, created_at: created,
  })
  unitsBySubject.set(row.id, [])
}
function unit(subjectId: string, u: Omit<Unit, 'id' | 'sortOrder'> & { id?: string }) {
  const list = unitsBySubject.get(subjectId)!
  const full: Unit = { ...u, id: u.id ?? id('unit'), sortOrder: list.length + 1 }
  list.push(full)
  return full
}

// Aisyah — Hafalan Juz 30 (dari preset)
const QURAN = 'dev_subject_quran'
subject({ id: QURAN, child: AISYAH, category: CAT.quran, name: 'Hafalan Juz 30', structure: 'range', unitLabel: 'ayat', suggestOrder: 'desc', preset: presetId(quranJuz30.code), order: 0 })
const surah = quranJuz30.units.map((u) => unit(QURAN, { id: `dev_quran_${u.key}`, label: u.label, size: u.size ?? null }))

// Aisyah — Matematika
const MTK = 'dev_subject_mtk'
subject({ id: MTK, child: AISYAH, category: CAT.sekolah, name: 'Matematika', structure: 'checklist', order: 1 })
const bilangan = unit(MTK, { label: 'Bilangan s/d 1000', size: null })
const jumlah = unit(MTK, { label: 'Penjumlahan bersusun', size: null })
const kali = unit(MTK, { label: 'Perkalian', size: null })
const tabel = [2, 3, 4, 5].map((n) => unit(MTK, { label: `Tabel ×${n}`, size: null, parentId: kali.id }))
const ukur = unit(MTK, { label: 'Pengukuran panjang', size: null })

// Aisyah — English Vocab (materi bertambah)
const VOCAB = 'dev_subject_vocab'
subject({ id: VOCAB, child: AISYAH, category: CAT.sekolah, name: 'English Vocab', structure: 'checklist', openEnded: true, order: 2 })
const words: [string, string, string][] = [
  ['apple', 'apel', 'fruit'], ['orange', 'jeruk', 'fruit'], ['banana', 'pisang', 'fruit'], ['mango', 'mangga', 'fruit'],
  ['kitchen', 'dapur', 'house'], ['spoon', 'sendok', 'house'], ['plate', 'piring', 'house'], ['chair', 'kursi', 'house'],
  ['cat', 'kucing', 'animal'], ['bird', 'burung', 'animal'], ['fish', 'ikan', 'animal'], ['horse', 'kuda', 'animal'],
  ['red', 'merah', 'color'], ['blue', 'biru', 'color'], ['green', 'hijau', 'color'], ['yellow', 'kuning', 'color'],
]
const vocab = words.map(([w, m, tag]) => unit(VOCAB, { label: w, size: null, meaning: m, tags: [tag] }))

// Aisyah — Baca buku (kebiasaan)
const BACA = 'dev_subject_baca'
subject({ id: BACA, child: AISYAH, category: CAT.kebiasaan, name: 'Baca buku', structure: 'none', order: 3 })

// Umar — Iqra (jumlah halaman contoh)
const IQRA = 'dev_subject_iqra'
subject({ id: IQRA, child: UMAR, category: CAT.quran, name: 'Iqra', structure: 'range', unitLabel: 'halaman', order: 0 })
const iqra = [1, 2, 3, 4, 5, 6].map((n) => unit(IQRA, { label: `Iqra ${n}`, size: 32 }))

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

type Item = { unit: Unit; from?: number; to?: number; mastery?: string }
const masteryLog = new Map<string, { date: string; ts: number; level: string }>()
const logIds: Record<string, string[]> = {}

/**
 * `result` hanya untuk membangkitkan data: 'ulang' → level materi 'kenal'
 * (muncul di "perlu diulang"); murajaah 'lancar' → 'mahir'.
 */
function log(row: { child: string; subject: string; date: string; kind?: 'ziyadah' | 'murajaah' | 'belajar' | 'latihan_soal'; minutes?: number | null; result?: 'lancar' | 'ulang'; mood?: string | null; note?: string | null; items?: Item[]; hour?: number }) {
  const logId = id('log')
  const ts = at(row.date, row.hour ?? 18, Math.floor(rand() * 59))
  insert('logs', {
    id: logId, child_id: row.child, subject_id: row.subject, logged_by: USER, date: row.date,
    duration_min: row.minutes ?? null,
    mood: row.mood ?? null, note: row.note ?? null, created_at: ts,
  })
  for (const it of row.items ?? []) {
    if (!it.mastery && row.result === 'ulang') it.mastery = 'kenal'
    if (!it.mastery && row.result === 'lancar' && row.kind === 'murajaah') it.mastery = 'mahir'
    insert('log_items', {
      id: id('item'), log_id: logId, unit_id: it.unit.id, range_from: it.from ?? null, range_to: it.to ?? null,
      cycle: surah.includes(it.unit) || iqra.includes(it.unit) ? 1 : null,
      mastery_after: it.mastery ?? null,
    })
    if (it.mastery) {
      const prev = masteryLog.get(it.unit.id)
      if (!prev || prev.date < row.date || (prev.date === row.date && prev.ts < ts)) {
        masteryLog.set(it.unit.id, { date: row.date, ts, level: it.mastery })
      }
    }
  }
  ;(logIds[row.subject] ??= []).push(logId)
  return logId
}

// Hafalan: mulai dari An-Nas mundur, ±3 ayat/hari, murajaah tiap 3 hari.
{
  const order = [...surah].reverse()
  let s = 0
  let ayat = 1
  const done: Unit[] = []
  for (let d = -56; d <= -1; d++) {
    const date = day(d)
    if (rand() < 0.78 && s < order.length) {
      const u = order[s]
      const to = Math.min(u.size!, ayat + 2 + Math.floor(rand() * 2))
      log({ child: AISYAH, subject: QURAN, date, kind: 'ziyadah', minutes: 10 + Math.floor(rand() * 10), result: rand() < 0.8 ? 'lancar' : 'ulang', mood: pick(['😄', '🙂', '🙂', '😐']), items: [{ unit: u, from: ayat, to }], hour: 18 })
      ayat = to + 1
      if (ayat > u.size!) {
        done.push(u)
        s++
        ayat = 1
      }
    }
    if (d % 3 === 0 && done.length > 0) {
      const u = pick(done)
      log({ child: AISYAH, subject: QURAN, date, kind: 'murajaah', minutes: 5, result: rand() < 0.75 ? 'lancar' : 'ulang', items: [{ unit: u }], hour: 19 })
    }
  }
}

// Matematika: latihan 3x/minggu, level naik pelan.
{
  log({ child: AISYAH, subject: MTK, date: day(-55), kind: 'belajar', minutes: 20, items: [{ unit: bilangan, mastery: 'mahir' }, { unit: jumlah, mastery: 'bisa' }] })
  log({ child: AISYAH, subject: MTK, date: day(-50), kind: 'latihan_soal', minutes: 20, items: [{ unit: jumlah, mastery: 'mahir' }] })
  let week = 0
  for (let d = -49; d <= -1; d++) {
    if (![1, 3, 5].includes(((d % 7) + 7) % 7)) continue
    week = Math.floor((d + 49) / 7)
    const target = week < 2 ? tabel[0] : week < 4 ? tabel[1] : tabel[2]
    const acc = Math.min(0.95, 0.5 + week * 0.06 + rand() * 0.1)
    const level = acc > 0.85 ? 'mahir' : acc > 0.7 ? 'bisa' : 'kenal'
    log({ child: AISYAH, subject: MTK, date: day(d), kind: 'latihan_soal', minutes: 15, result: acc > 0.75 ? 'lancar' : 'ulang', mood: acc > 0.75 ? '🙂' : '😩', items: [{ unit: target, mastery: level }], note: acc < 0.65 ? 'Masih hitung jari' : null })
  }
  log({ child: AISYAH, subject: MTK, date: day(-3), kind: 'belajar', minutes: 15, items: [{ unit: tabel[2], mastery: 'kenal' }] })
  log({ child: AISYAH, subject: MTK, date: day(-2), kind: 'belajar', minutes: 20, result: 'ulang', items: [{ unit: ukur, mastery: 'kenal' }], note: 'Baru kenal cm dan m' })
}

// Vocab: 2 kata baru tiap ±4 hari, kata lama naik level.
{
  vocab.forEach((w, i) => {
    const d = -52 + i * 3
    log({ child: AISYAH, subject: VOCAB, date: day(d), kind: 'belajar', minutes: 10, items: [{ unit: w, mastery: 'kenal' }] })
    if (d + 10 < 0) log({ child: AISYAH, subject: VOCAB, date: day(d + 10), kind: 'belajar', minutes: 5, items: [{ unit: w, mastery: rand() < 0.6 ? 'bisa' : 'kenal' }] })
    if (d + 25 < 0 && rand() < 0.5) log({ child: AISYAH, subject: VOCAB, date: day(d + 25), kind: 'belajar', minutes: 5, items: [{ unit: w, mastery: 'mahir' }] })
  })
}

// Baca buku: sering, 9 hari terakhir berturut-turut.
for (let d = -56; d <= -1; d++) {
  if (d >= -9 || rand() < 0.65) {
    log({ child: AISYAH, subject: BACA, date: day(d), minutes: pick([10, 15, 15, 20]), mood: pick(['😄', '🙂']), hour: 20 })
  }
}

// Iqra Umar: 5x/minggu, 1–2 halaman.
{
  let jilid = 0
  let page = 1
  for (let d = -56; d <= -1; d++) {
    if (rand() > 0.72) continue
    const u = iqra[jilid]
    const to = Math.min(u.size!, page + (rand() < 0.5 ? 0 : 1))
    log({ child: UMAR, subject: IQRA, date: day(d), kind: 'belajar', minutes: 10, result: rand() < 0.8 ? 'lancar' : 'ulang', items: [{ unit: u, from: page, to }], hour: 17 })
    page = to + 1
    if (page > u.size!) {
      jilid++
      page = 1
    }
  }
}

// Cache level dari log terbaru.
for (const [subjectId, list] of unitsBySubject) {
  for (const u of list) {
    insert('units', {
      id: u.id, subject_id: subjectId, parent_id: u.parentId ?? null, label: u.label, size: u.size,
      mastery: masteryLog.get(u.id)?.level ?? null, meaning: u.meaning ?? null, tags: u.tags ?? [],
      sort_order: u.sortOrder, created_at: created,
    })
  }
}
// Unit harus ada sebelum log_items → pindahkan insert units ke depan log.
{
  const unitSql = sql.filter((s) => s.startsWith('INSERT INTO units '))
  const rest = sql.filter((s) => !s.startsWith('INSERT INTO units '))
  const firstLog = rest.findIndex((s) => s.startsWith('INSERT INTO logs '))
  sql.length = 0
  sql.push(...rest.slice(0, firstLog), ...unitSql, ...rest.slice(firstLog))
}

// ---------------------------------------------------------------------------
// Jalankan
// ---------------------------------------------------------------------------

const dir = mkdtempSync(join(tmpdir(), 'kids-tracker-dev-seed-'))
const file = join(dir, 'dev.sql')
writeFileSync(file, `${sql.join('\n')}\n`)
const logCount = Object.values(logIds).flat().length
console.log(`Seeding data demo: ${logCount} log, ${sql.length} statement → local`)
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'kids-tracker', '--local', '--file', file, '--yes'], { stdio: ['ignore', 'ignore', 'inherit'] })
  console.log('Selesai. Login: demo@kids.test / password123')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
