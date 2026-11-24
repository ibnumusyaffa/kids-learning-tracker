/**
 * Helper server-only untuk menyimpan log. Lihat docs.md bagian 5.8.
 */
import '@tanstack/react-start/server-only'
import { and, eq, isNull, max, sql } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { chunkRows } from '@/db/batch'
import { deleteObjects } from './storage.server'
import {
  type LogItemInput,
  LogRuleError,
  normalizeLogItems,
} from '@/lib/log-rules'

type Subject = typeof schema.subjects.$inferSelect
type Db = ReturnType<typeof getDb>
type BatchItem = Parameters<Db['batch']>[0][number]

export type LogFieldsInput = {
  date: string
  durationMin?: number | null
  mood?: string | null
  note?: string | null
  items: LogItemInput[]
}

export function assertNotFuture(date: string, today: string) {
  if (date > today) throw new LogRuleError('FUTURE_DATE')
}

export function logFields(input: LogFieldsInput) {
  return {
    date: input.date,
    durationMin: input.durationMin ?? null,
    mood: input.mood || null,
    note: input.note?.trim() || null,
  }
}

/**
 * Validasi item lalu siapkan statement insert (materi baru + log_items).
 * Mengembalikan juga daftar unit yang levelnya perlu dihitung ulang.
 */
export async function prepareItems(
  subject: Subject,
  logId: string,
  items: LogItemInput[],
) {
  const db = getDb()
  const unitRows = await db
    .select({ id: schema.units.id, size: schema.units.size })
    .from(schema.units)
    .where(and(eq(schema.units.subjectId, subject.id), isNull(schema.units.archivedAt)))
  const units = new Map(unitRows.map((u) => [u.id, { size: u.size }]))

  const normalized = normalizeLogItems(subject, units, items)

  let nextOrder = 0
  if (normalized.some((n) => n.unit.kind === 'new')) {
    const [{ maxOrder }] = await db
      .select({ maxOrder: max(schema.units.sortOrder) })
      .from(schema.units)
      .where(eq(schema.units.subjectId, subject.id))
    nextOrder = (maxOrder ?? 0) + 1
  }

  const now = new Date()
  const newUnits: (typeof schema.units.$inferInsert)[] = []
  const itemRows: (typeof schema.logItems.$inferInsert)[] = []
  const touchedMastery = new Set<string>()

  for (const n of normalized) {
    let unitId: string
    if (n.unit.kind === 'new') {
      unitId = crypto.randomUUID()
      newUnits.push({
        id: unitId,
        subjectId: subject.id,
        label: n.unit.label,
        meaning: n.unit.meaning,
        tags: n.unit.tags,
        size: n.unit.size,
        mastery: n.masteryAfter,
        sortOrder: nextOrder++,
        createdAt: now,
      })
    } else {
      unitId = n.unit.id
      if (n.masteryAfter) touchedMastery.add(unitId)
    }
    itemRows.push({
      id: crypto.randomUUID(),
      logId,
      unitId,
      rangeFrom: n.rangeFrom,
      rangeTo: n.rangeTo,
      cycle: subject.structure === 'range' ? subject.currentCycle : null,
      masteryAfter: n.masteryAfter,
    })
  }

  const statements: BatchItem[] = [
    ...chunkRows(newUnits).map((rows) => db.insert(schema.units).values(rows)),
    ...chunkRows(itemRows).map((rows) => db.insert(schema.logItems).values(rows)),
  ]
  return { statements, touchedMastery }
}

/**
 * Cache `units.mastery` = mastery_after dari log terbaru (tanggal, lalu waktu
 * dibuat). Kalau tidak ada log dengan level, nilai sekarang dipertahankan
 * (bisa jadi diisi manual dari halaman materi).
 */
export function recomputeMastery(unitIds: Iterable<string>): BatchItem[] {
  const db = getDb()
  return [...unitIds].map((unitId) =>
    db
      .update(schema.units)
      .set({
        mastery: sql`coalesce((
          select li.mastery_after from log_items li
          join logs l on l.id = li.log_id
          where li.unit_id = ${unitId} and li.mastery_after is not null
          order by l.date desc, l.created_at desc
          limit 1
        ), mastery)`,
      })
      .where(eq(schema.units.id, unitId)),
  )
}

/** Unit yang punya mastery_after di log ini (untuk dihitung ulang). */
export async function masteryUnitsOfLog(logId: string) {
  const rows = await getDb()
    .select({ unitId: schema.logItems.unitId })
    .from(schema.logItems)
    .where(
      and(
        eq(schema.logItems.logId, logId),
        sql`${schema.logItems.masteryAfter} is not null`,
      ),
    )
  return rows.map((r) => r.unitId)
}

export async function runBatch(statements: BatchItem[]) {
  if (statements.length === 0) return
  const db = getDb()
  await db.batch(statements as [BatchItem, ...BatchItem[]])
}

/**
 * Hapus log beserta item, foto R2,
 * lalu hitung ulang level materi yang terdampak.
 */
export async function deleteLogCascade(logId: string) {
  const db = getDb()
  const [before, files] = await Promise.all([
    masteryUnitsOfLog(logId),
    db
      .select({ key: schema.attachments.r2Key })
      .from(schema.attachments)
      .where(eq(schema.attachments.logId, logId)),
  ])
  await runBatch([db.delete(schema.logs).where(eq(schema.logs.id, logId)), ...recomputeMastery(before)])
  await deleteObjects(files.map((f) => f.key))
}
