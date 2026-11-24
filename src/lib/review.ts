/**
 * Kandidat murajaah / perlu diulang. Lihat docs.md bagian 5.12.
 *
 * Sebuah materi perlu diulang kalau:
 * - level di catatan terakhirnya 'belum' atau 'kenal', atau
 * - sudah pernah dipelajari tapi tidak disentuh ≥ `staleDays` hari
 *   (`includeStale`, dipakai untuk materi range seperti hafalan)
 */
import type { MasteryLevel } from '@/db/enums'
import type { LocalDate } from '@/lib/dates'

export type ReviewInput = {
  id: string
  label: string
  sortOrder: number
  /** Sudah pernah dipelajari (range: ada ayat tersentuh; checklist: ada log). */
  started: boolean
  /** Catatan terakhir yang menyentuh materi ini + level yang diberikan. */
  last: { date: LocalDate; mastery: MasteryLevel | null } | null
}

export type ReviewCandidate = {
  unitId: string
  label: string
  reason: 'weak' | 'stale'
  days: number
}

const daysBetween = (a: LocalDate, b: LocalDate) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  )

export function reviewCandidates(
  units: ReviewInput[],
  today: LocalDate,
  opts: { staleDays?: number; limit?: number; includeStale?: boolean } = {},
): ReviewCandidate[] {
  const { staleDays = 14, limit = 3, includeStale = true } = opts
  const weak: ReviewCandidate[] = []
  const stale: ReviewCandidate[] = []

  for (const u of units) {
    if (!u.last || u.last.date >= today) continue
    const days = daysBetween(u.last.date, today)
    if (u.last.mastery === 'belum' || u.last.mastery === 'kenal') {
      weak.push({ unitId: u.id, label: u.label, reason: 'weak', days })
    } else if (includeStale && u.started && days >= staleDays) {
      stale.push({ unitId: u.id, label: u.label, reason: 'stale', days })
    }
  }

  // Yang lemah dulu (paling lama duluan), lalu yang lama tidak diulang.
  weak.sort((a, b) => b.days - a.days)
  stale.sort((a, b) => b.days - a.days)
  return [...weak, ...stale].slice(0, limit)
}
