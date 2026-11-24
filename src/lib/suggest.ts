/**
 * Saran materi berikutnya untuk pelajaran `range`. Lihat docs.md bagian 5.7.
 *
 * 1. Materi yang sedang berjalan (sudah disentuh, belum selesai) → lanjut dari
 *    celah pertama.
 * 2. Kalau tidak ada: materi belum dimulai sesuai `suggest_order`.
 */
import type { SuggestOrder } from '@/db/enums'

export type SuggestUnit = {
  id: string
  sortOrder: number
  progress: {
    covered: number
    done: boolean
    nextGap: [number, number] | null
  } | null
}

export type RangeSuggestion = {
  unitId: string
  /** null = mulai materi baru dari awal. */
  from: number | null
  to: number | null
  reason: 'continue' | 'next'
}

export function suggestRange(
  units: SuggestUnit[],
  order: SuggestOrder,
): RangeSuggestion | null {
  const sorted = [...units].sort((a, b) => a.sortOrder - b.sortOrder)

  const inProgress = sorted.find(
    (u) => u.progress && u.progress.covered > 0 && !u.progress.done,
  )
  if (inProgress?.progress?.nextGap) {
    const [from, to] = inProgress.progress.nextGap
    return { unitId: inProgress.id, from, to, reason: 'continue' }
  }

  if (order === 'manual') return null
  const notStarted = sorted.filter(
    (u) => !u.progress || (u.progress.covered === 0 && !u.progress.done),
  )
  const next = order === 'desc' ? notStarted.at(-1) : notStarted[0]
  return next ? { unitId: next.id, from: null, to: null, reason: 'next' } : null
}
