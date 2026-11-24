/**
 * Progres materi `range` (ayat/halaman).
 *
 * Progres = jumlah posisi UNIK yang sudah tersentuh, bukan posisi terbesar,
 * karena materi boleh dikerjakan tidak berurutan. `from`/`to` null berarti
 * seluruh materi. Lihat docs.md bagian 5.12.
 */

export type RangeTouch = { from: number | null; to: number | null }

type Interval = [start: number, end: number]

/** Gabungkan semua sentuhan menjadi interval terurut yang tidak tumpang tindih. */
export function mergeTouches(size: number, touches: RangeTouch[]): Interval[] {
  if (size <= 0) return []

  const intervals: Interval[] = []
  for (const t of touches) {
    const start = Math.max(1, t.from ?? 1)
    const end = Math.min(size, t.to ?? size)
    if (start <= end) intervals.push([start, end])
  }
  intervals.sort((a, b) => a[0] - b[0])

  const merged: Interval[] = []
  for (const [start, end] of intervals) {
    const last = merged.at(-1)
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

export function coveredCount(size: number, touches: RangeTouch[]): number {
  return mergeTouches(size, touches).reduce(
    (sum, [start, end]) => sum + end - start + 1,
    0,
  )
}

export function isComplete(size: number, touches: RangeTouch[]): boolean {
  return size > 0 && coveredCount(size, touches) === size
}

/** Bagian yang belum tersentuh, untuk saran "lanjut ayat X". */
export function gaps(size: number, touches: RangeTouch[]): Interval[] {
  const result: Interval[] = []
  let next = 1
  for (const [start, end] of mergeTouches(size, touches)) {
    if (start > next) result.push([next, start - 1])
    next = end + 1
  }
  if (next <= size) result.push([next, size])
  return result
}

export type RangeProgress = {
  covered: number
  size: number
  percent: number
  complete: boolean
  nextGap: Interval | null
}

export function rangeProgress(
  size: number,
  touches: RangeTouch[],
): RangeProgress {
  const covered = coveredCount(size, touches)
  return {
    covered,
    size,
    percent: size > 0 ? Math.round((covered / size) * 100) : 0,
    complete: size > 0 && covered === size,
    nextGap: gaps(size, touches)[0] ?? null,
  }
}
