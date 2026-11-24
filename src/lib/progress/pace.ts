/**
 * Kecepatan & perkiraan selesai untuk pelajaran `range` (hafalan, Iqra, buku).
 * Dihitung otomatis dari catatan; tidak butuh input target.
 *
 * kecepatan = ayat/halaman unik yang bertambah dalam `windowDays` terakhir.
 */
import { type LocalDate, addDays } from '@/lib/dates'
import { type RangeTouch, coveredCount } from './range'

export type DatedTouch = RangeTouch & { date: LocalDate }

export type PaceUnit = {
  size: number
  /** Ditandai selesai manual → dianggap sudah penuh sejak awal. */
  completed: boolean
  touches: DatedTouch[]
}

export type RangePace = {
  covered: number
  total: number
  /** Ayat/halaman per minggu dalam jendela waktu. */
  perWeek: number
  /** null = sudah selesai, atau belum ada kemajuan dalam jendela waktu. */
  eta: LocalDate | null
  done: boolean
}

function coveredAsOf(units: PaceUnit[], date: LocalDate | null) {
  return units.reduce((n, u) => {
    if (u.completed) return n + u.size
    const touches = date === null ? u.touches : u.touches.filter((t) => t.date <= date)
    return n + coveredCount(u.size, touches)
  }, 0)
}

export function rangePace(units: PaceUnit[], today: LocalDate, windowDays = 28): RangePace {
  const total = units.reduce((n, u) => n + u.size, 0)
  const covered = coveredAsOf(units, null)
  const before = coveredAsOf(units, addDays(today, -windowDays))
  const gained = Math.max(0, covered - before)
  const perWeek = Math.round((gained / windowDays) * 7 * 10) / 10
  const remaining = total - covered
  const done = total > 0 && remaining <= 0
  const eta =
    done || gained === 0 ? null : addDays(today, Math.ceil(remaining / (gained / windowDays)))
  return { covered, total, perWeek, eta, done }
}
