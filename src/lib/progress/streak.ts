import { addDays, type LocalDate } from '@/lib/dates'

/**
 * Streak saat ini: jumlah hari berturut-turut yang punya log, berakhir hari ini.
 * Kalau hari ini belum ada log, streak kemarin masih dihitung (belum putus).
 */
export function currentStreak(dates: Iterable<LocalDate>, today: LocalDate) {
  const set = new Set(dates)
  let day = set.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (set.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

/** Streak terpanjang sepanjang waktu. */
export function longestStreak(dates: Iterable<LocalDate>) {
  const sorted = [...new Set(dates)].sort()
  let best = 0
  let run = 0
  let prev: LocalDate | null = null
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}
