/**
 * Menyusun isi layar "Hari Ini". Server-only. Lihat docs.md bagian 7.2.
 *
 * Isi per anak:
 * 1. Kebiasaan (`none`): centang harian
 * 2. Saran lanjut (range): materi berjalan / materi berikutnya
 * 3. Perlu diulang: level terakhir lemah (belum/kenal), atau lama tidak diulang
 */
import '@tanstack/react-start/server-only'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { Structure } from '@/db/enums'
import type { LocalDate } from '@/lib/dates'
import { type ReviewCandidate, reviewCandidates } from '@/lib/review'
import { suggestRange } from '@/lib/suggest'
import { loadActiveUnits, loadRangeProgress } from './progress.server'

type SubjectRef = { id: string; name: string; structure: Structure; unitLabel: string | null }

export type TodayHabit = { kind: 'habit'; subject: SubjectRef; done: boolean }

export type TodaySuggestion = {
  kind: 'suggestion'
  subject: SubjectRef
  unitId: string
  unitLabel: string
  from: number | null
  to: number | null
  reason: 'continue' | 'next'
}

export type TodayReview = {
  kind: 'review'
  subject: SubjectRef
  units: ReviewCandidate[]
}

export type TodayChild = {
  child: { id: string; name: string; avatar: string | null; birthDate: string | null }
  /** Untuk tautan "tambah pelajaran" saat kosong. */
  subjects: { id: string; name: string }[]
  habits: TodayHabit[]
  suggestions: (TodaySuggestion | TodayReview)[]
  done: number
  total: number
}

export async function buildToday(familyId: string, today: LocalDate): Promise<TodayChild[]> {
  const db = getDb()
  const children = await db
    .select({
      id: schema.children.id,
      name: schema.children.name,
      avatar: schema.children.avatar,
      birthDate: schema.children.birthDate,
    })
    .from(schema.children)
    .where(and(eq(schema.children.familyId, familyId), isNull(schema.children.archivedAt)))
    .orderBy(asc(schema.children.createdAt))
  if (children.length === 0) return []
  const childIds = children.map((c) => c.id)

  const [subjects, logsToday] = await Promise.all([
    db
      .select()
      .from(schema.subjects)
      .where(and(inArray(schema.subjects.childId, childIds), isNull(schema.subjects.archivedAt)))
      .orderBy(asc(schema.subjects.sortOrder), asc(schema.subjects.createdAt)),
    db
      .select({ subjectId: schema.logs.subjectId, unitId: schema.logItems.unitId })
      .from(schema.logs)
      .leftJoin(schema.logItems, eq(schema.logItems.logId, schema.logs.id))
      .where(and(inArray(schema.logs.childId, childIds), eq(schema.logs.date, today))),
  ])
  const loggedToday = new Set(logsToday.map((l) => l.subjectId))
  // Materi yang sudah dicatat hari ini tidak disarankan lagi hari ini.
  const touchedToday = new Set(logsToday.map((l) => l.unitId).filter(Boolean))

  const ref = (s: (typeof subjects)[number]): SubjectRef => ({
    id: s.id,
    name: s.name,
    structure: s.structure,
    unitLabel: s.unitLabel,
  })

  // Data untuk saran (range & checklist).
  const material = subjects.filter((s) => s.structure !== 'none')
  const units = await loadActiveUnits(material.map((s) => s.id))
  const rangeSubjects = material.filter((s) => s.structure === 'range')
  const progress = await loadRangeProgress(
    rangeSubjects,
    units.filter((u) => rangeSubjects.some((s) => s.id === u.subjectId)),
  )
  const lastTouch = await loadLastTouch(units.map((u) => u.subjectId))

  return children.map((child) => {
    const mine = subjects.filter((s) => s.childId === child.id)

    const habits: TodayHabit[] = mine
      .filter((s) => s.structure === 'none')
      .map((s) => ({ kind: 'habit', subject: ref(s), done: loggedToday.has(s.id) }))

    const suggestions: (TodaySuggestion | TodayReview)[] = []
    for (const s of mine) {
      if (s.structure === 'none') continue
      const ownAll = units.filter((u) => u.subjectId === s.id)
      // Topik induk (punya sub-topik) tidak dicatat langsung, jadi tidak disarankan.
      const parentIds = new Set(ownAll.map((u) => u.parentId).filter(Boolean))
      const own = ownAll.filter((u) => !parentIds.has(u.id))

      // Materi yang sedang disarankan untuk dilanjutkan tidak ikut "perlu diulang".
      let continuing: string | null = null
      if (s.structure === 'range') {
        const pick = suggestRange(
          own.map((u) => ({ id: u.id, sortOrder: u.sortOrder, progress: progress.get(u.id) ?? null })),
          s.suggestOrder,
        )
        const unit = pick && own.find((u) => u.id === pick.unitId)
        if (pick?.reason === 'continue') continuing = pick.unitId
        if (pick && unit && !touchedToday.has(unit.id)) {
          suggestions.push({
            kind: 'suggestion',
            subject: ref(s),
            unitId: unit.id,
            unitLabel: unit.label,
            from: pick.from,
            to: pick.to,
            reason: pick.reason,
          })
        }
      }

      const candidates = reviewCandidates(
        own.filter((u) => u.id !== continuing).map((u) => ({
          id: u.id,
          label: u.label,
          sortOrder: u.sortOrder,
          started:
            s.structure === 'range'
              ? (progress.get(u.id)?.covered ?? 0) > 0 || u.completedAt !== null
              : lastTouch.has(u.id),
          // Tanggal dari catatan terakhir; level dari cache units.mastery
          // (level terakhir yang diketahui, dari catatan atau diisi manual).
          last: lastTouch.has(u.id) ? { date: lastTouch.get(u.id)!, mastery: u.mastery } : null,
        })),
        today,
        { includeStale: s.structure === 'range' },
      )
      if (candidates.length > 0) {
        suggestions.push({
          kind: 'review',
          subject: ref(s),
          units: candidates,
        })
      }
    }

    const done = habits.filter((h) => h.done).length
    return {
      child,
      subjects: mine.map((s) => ({ id: s.id, name: s.name })),
      habits,
      suggestions,
      done,
      total: habits.length,
    }
  })
}

/** Tanggal catatan terakhir yang menyentuh tiap unit. */
async function loadLastTouch(subjectIds: string[]) {
  const result = new Map<string, LocalDate>()
  const ids = [...new Set(subjectIds)]
  if (ids.length === 0) return result
  const rows = await getDb()
    .select({
      unitId: schema.logItems.unitId,
      date: schema.logs.date,
    })
    .from(schema.logItems)
    .innerJoin(schema.logs, eq(schema.logItems.logId, schema.logs.id))
    .where(inArray(schema.logs.subjectId, ids))
    .orderBy(desc(schema.logs.date), desc(schema.logs.createdAt))
  for (const r of rows) if (!result.has(r.unitId)) result.set(r.unitId, r.date)
  return result
}
