/**
 * Export data keluarga (JSON lengkap atau CSV catatan). Server-only.
 * Foto tidak ikut (hanya metadata); file asli tetap di R2.
 */
import '@tanstack/react-start/server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import { getDb, schema } from '@/db'

/** Versi 5: tanpa nilai, jenis kegiatan, kualitas, ukuran, benar/soal, todo, dan target. */
export const EXPORT_VERSION = 5

async function inChunks<T>(ids: string[], fn: (chunk: string[]) => Promise<T[]>) {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 90) out.push(...(await fn(ids.slice(i, i + 90))))
  return out
}

export async function exportFamily(familyId: string) {
  const db = getDb()
  const [family] = await db
    .select({ id: schema.organization.id, name: schema.organization.name, timezone: schema.organization.timezone })
    .from(schema.organization)
    .where(eq(schema.organization.id, familyId))

  const [children, categories] = await Promise.all([
    db.select().from(schema.children).where(eq(schema.children.familyId, familyId)).orderBy(asc(schema.children.createdAt)),
    db.select().from(schema.categories).where(eq(schema.categories.familyId, familyId)),
  ])
  const childIds = children.map((c) => c.id)
  const subjects = await inChunks(childIds, (ids) =>
    db.select().from(schema.subjects).where(inArray(schema.subjects.childId, ids)),
  )
  const subjectIds = subjects.map((s) => s.id)

  const [units, logs] = await Promise.all([
    inChunks(subjectIds, (ids) => db.select().from(schema.units).where(inArray(schema.units.subjectId, ids))),
    inChunks(childIds, (ids) =>
      db.select().from(schema.logs).where(inArray(schema.logs.childId, ids)).orderBy(asc(schema.logs.date)),
    ),
  ])
  const logIds = logs.map((l) => l.id)
  const [logItems, attachments] = await Promise.all([
    inChunks(logIds, (ids) => db.select().from(schema.logItems).where(inArray(schema.logItems.logId, ids))),
    inChunks(logIds, (ids) =>
      db
        .select({
          id: schema.attachments.id,
          logId: schema.attachments.logId,
          contentType: schema.attachments.contentType,
          sizeBytes: schema.attachments.sizeBytes,
          createdAt: schema.attachments.createdAt,
        })
        .from(schema.attachments)
        .where(inArray(schema.attachments.logId, ids)),
    ),
  ])

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    family,
    categories,
    children,
    subjects,
    units,
    logs,
    logItems,
    attachments,
  }
}

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // Cegah formula injection di spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** Satu baris per materi yang disentuh (log tanpa materi tetap satu baris). */
export function logsToCsv(data: Awaited<ReturnType<typeof exportFamily>>) {
  const child = new Map(data.children.map((c) => [c.id, c.name]))
  const subject = new Map(data.subjects.map((s) => [s.id, s]))
  const unit = new Map(data.units.map((u) => [u.id, u.label]))
  const items = new Map<string, typeof data.logItems>()
  for (const i of data.logItems) items.set(i.logId, [...(items.get(i.logId) ?? []), i])

  const header = [
    'tanggal', 'anak', 'pelajaran', 'materi', 'dari', 'sampai', 'level',
    'menit', 'mood', 'catatan',
  ]
  const rows = [header.join(',')]
  for (const l of data.logs) {
    const its = items.get(l.id) ?? [null]
    for (const i of its) {
      rows.push(
        [
          l.date, child.get(l.childId), subject.get(l.subjectId)?.name,
          i ? unit.get(i.unitId) : null, i?.rangeFrom, i?.rangeTo, i?.masteryAfter,
          l.durationMin, l.mood, l.note,
        ]
          .map(csvCell)
          .join(','),
      )
    }
  }
  // BOM supaya Excel membaca UTF-8 (nama surah, emoji).
  return `﻿${rows.join('\r\n')}\r\n`
}
