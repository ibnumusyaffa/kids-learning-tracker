/**
 * Menyusun statistik anak. Server-only.
 */
import '@tanstack/react-start/server-only'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { MasteryLevel } from '@/db/enums'
import { type LocalDate, addDays, monthStart, todayIn, weekStart } from '@/lib/dates'
import { currentStreak, longestStreak } from '@/lib/progress/streak'
import { getChildForFamily } from './access.server'
import { loadActiveUnits, loadRangeProgress } from './progress.server'

/** Heatmap: 18 minggu terakhir (Senin–Minggu), berakhir minggu ini. */
export const HEATMAP_WEEKS = 18

export async function buildChildStats(childId: string, familyId: string, timezone: string) {
  const child = await getChildForFamily(childId, familyId)
  const today = todayIn(timezone)
  const db = getDb()

  const subjects = await db
    .select()
    .from(schema.subjects)
    .where(and(eq(schema.subjects.childId, child.id), isNull(schema.subjects.archivedAt)))
    .orderBy(asc(schema.subjects.sortOrder), asc(schema.subjects.createdAt))
  const subjectIds = subjects.map((s) => s.id)

  const heatmapStart = addDays(weekStart(today), -7 * (HEATMAP_WEEKS - 1))

  const [logs, units] = await Promise.all([
    db
      .select({
        subjectId: schema.logs.subjectId,
        date: schema.logs.date,
        durationMin: schema.logs.durationMin,
      })
      .from(schema.logs)
      .where(eq(schema.logs.childId, child.id)),
    loadActiveUnits(subjectIds),
  ])

  // --- Heatmap & streak -----------------------------------------------------
  const perDay = new Map<LocalDate, { sessions: number; minutes: number }>()
  for (const l of logs) {
    const d = perDay.get(l.date) ?? { sessions: 0, minutes: 0 }
    d.sessions++
    d.minutes += l.durationMin ?? 0
    perDay.set(l.date, d)
  }
  const heatmap: { date: LocalDate; sessions: number; minutes: number }[] = []
  for (let d = heatmapStart; d <= today; d = addDays(d, 1)) {
    heatmap.push({ date: d, ...(perDay.get(d) ?? { sessions: 0, minutes: 0 }) })
  }
  const dates = [...perDay.keys()]
  const last30 = addDays(today, -29)

  // --- Menit per pelajaran ----------------------------------------------------
  const thisWeek = weekStart(today)
  const thisMonth = monthStart(today)
  const minutes = subjects
    .map((s) => {
      const own = logs.filter((l) => l.subjectId === s.id)
      const sum = (from: LocalDate) =>
        own.filter((l) => l.date >= from && l.date <= today).reduce((n, l) => n + (l.durationMin ?? 0), 0)
      return { subjectId: s.id, name: s.name, week: sum(thisWeek), month: sum(thisMonth), last30: sum(last30) }
    })
    .filter((m) => m.last30 > 0 || m.month > 0)

  // --- Peta hafalan (range) ---------------------------------------------------
  const rangeSubjects = subjects.filter((s) => s.structure === 'range')
  const progress = await loadRangeProgress(
    rangeSubjects,
    units.filter((u) => rangeSubjects.some((s) => s.id === u.subjectId)),
  )
  const rangeMaps = rangeSubjects.map((s) => ({
    subjectId: s.id,
    name: s.name,
    unitLabel: s.unitLabel,
    units: units
      .filter((u) => u.subjectId === s.id)
      .map((u) => {
        const p = progress.get(u.id)
        return {
          id: u.id,
          label: u.label,
          size: u.size ?? 0,
          covered: p?.covered ?? 0,
          percent: p?.percent ?? 0,
          done: p?.done ?? false,
          mastery: u.mastery,
        }
      }),
  }))

  // --- Level topik (checklist) ------------------------------------------------
  const checklistSubjects = subjects.filter((s) => s.structure === 'checklist')
  const topics = checklistSubjects.map((s) => {
    const own = units.filter((u) => u.subjectId === s.id)
    const parents = new Set(own.map((u) => u.parentId).filter(Boolean))
    const leaves = own.filter((u) => !parents.has(u.id))
    const levels: Record<MasteryLevel, number> = { belum: 0, kenal: 0, bisa: 0, mahir: 0 }
    for (const u of leaves) levels[u.mastery ?? 'belum']++

    return { subjectId: s.id, name: s.name, openEnded: s.openEnded, total: leaves.length, levels }
  })

  return {
    child: { id: child.id, name: child.name, avatar: child.avatar },
    today,
    streak: { current: currentStreak(dates, today), longest: longestStreak(dates) },
    totals: {
      activeDays30: dates.filter((d) => d >= last30 && d <= today).length,
      minutesWeek: minutes.reduce((n, m) => n + m.week, 0),
      minutesMonth: minutes.reduce((n, m) => n + m.month, 0),
    },
    heatmap,
    minutes,
    rangeMaps,
    topics,
  }
}

export type ChildStats = Awaited<ReturnType<typeof buildChildStats>>
