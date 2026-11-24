/**
 * Menghitung progres dari log. Server-only.
 * Logika murni ada di `@/lib/progress`; file ini hanya mengambil datanya.
 */
import '@tanstack/react-start/server-only'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { LocalDate } from '@/lib/dates'
import { type DatedTouch, type RangePace, rangePace } from '@/lib/progress/pace'
import { type RangeProgress, rangeProgress } from '@/lib/progress/range'

export type UnitRow = typeof schema.units.$inferSelect

export type UnitProgress = RangeProgress & { done: boolean }

/** Sentuhan range per unit untuk putaran (`cycle`) yang sedang berjalan. */
async function loadTouches(subjects: { id: string; currentCycle: number }[]) {
  const touches = new Map<string, DatedTouch[]>()
  if (subjects.length === 0) return touches

  const rows = await getDb()
    .select({
      unitId: schema.logItems.unitId,
      subjectId: schema.units.subjectId,
      from: schema.logItems.rangeFrom,
      to: schema.logItems.rangeTo,
      cycle: schema.logItems.cycle,
      date: schema.logs.date,
    })
    .from(schema.logItems)
    .innerJoin(schema.units, eq(schema.logItems.unitId, schema.units.id))
    .innerJoin(schema.logs, eq(schema.logItems.logId, schema.logs.id))
    .where(
      inArray(
        schema.units.subjectId,
        subjects.map((s) => s.id),
      ),
    )

  const cycleOf = new Map(subjects.map((s) => [s.id, s.currentCycle]))
  for (const r of rows) {
    if (r.cycle !== null && r.cycle !== cycleOf.get(r.subjectId)) continue
    const list = touches.get(r.unitId) ?? []
    list.push({ from: r.from, to: r.to, date: r.date })
    touches.set(r.unitId, list)
  }
  return touches
}

type RangeUnit = Pick<UnitRow, 'id' | 'subjectId' | 'size' | 'completedAt'>

/**
 * Progres per materi range + kecepatan & perkiraan selesai per pelajaran
 * (kalau `today` diisi). Lihat `@/lib/progress/pace`.
 */
export async function loadRangeState(
  subjects: { id: string; currentCycle: number }[],
  units: RangeUnit[],
  today?: LocalDate,
) {
  const touches = await loadTouches(subjects)
  const progress = new Map<string, UnitProgress>()
  for (const u of units) {
    const p = rangeProgress(u.size ?? 0, touches.get(u.id) ?? [])
    progress.set(u.id, { ...p, done: p.complete || u.completedAt !== null })
  }
  const pace = new Map<string, RangePace>()
  if (today) {
    for (const s of subjects) {
      const own = units.filter((u) => u.subjectId === s.id)
      if (own.length === 0) continue
      pace.set(
        s.id,
        rangePace(
          own.map((u) => ({
            size: u.size ?? 0,
            completed: u.completedAt !== null,
            touches: touches.get(u.id) ?? [],
          })),
          today,
        ),
      )
    }
  }
  return { progress, pace }
}

export async function loadRangeProgress(
  subjects: { id: string; currentCycle: number }[],
  units: RangeUnit[],
) {
  return (await loadRangeState(subjects, units)).progress
}

export async function loadActiveUnits(subjectIds: string[]) {
  if (subjectIds.length === 0) return []
  return getDb()
    .select()
    .from(schema.units)
    .where(
      and(
        inArray(schema.units.subjectId, subjectIds),
        isNull(schema.units.archivedAt),
      ),
    )
    .orderBy(schema.units.sortOrder)
}
