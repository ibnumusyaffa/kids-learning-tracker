/**
 * Tanggal kalender lokal keluarga ('YYYY-MM-DD').
 *
 * Workers berjalan di UTC, jadi "hari ini" selalu dihitung dari zona waktu
 * keluarga. Lihat docs.md bagian 5.2.
 */
import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export type LocalDate = string

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isLocalDate(value: string): value is LocalDate {
  return LOCAL_DATE_RE.test(value)
}

/** Tanggal hari ini di zona waktu tertentu. */
export function todayIn(timezone: string, now: Date = new Date()): LocalDate {
  return format(new TZDate(now, timezone), 'yyyy-MM-dd')
}

/** Geser tanggal lokal sebanyak `days` hari (boleh negatif). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 'Minggu, 22 November 2026' */
export function formatLocalDate(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number)
  return format(new Date(y, m - 1, d), 'EEEE, d MMMM yyyy', {
    locale: localeId,
  })
}

/** 'Sen, 23 Nov' (tambah tahun kalau beda tahun dengan `today`). */
export function formatShortDate(date: LocalDate, today?: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number)
  const sameYear = !today || today.slice(0, 4) === date.slice(0, 4)
  return format(new Date(y, m - 1, d), sameYear ? 'EEE, d MMM' : 'd MMM yyyy', {
    locale: localeId,
  })
}

/** Indeks hari Senin=0 … Minggu=6 untuk tanggal lokal. */
export function mondayIndex(date: LocalDate): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** Senin di minggu yang memuat `date`. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -mondayIndex(date))
}

/** Tanggal 1 di bulan yang memuat `date`. */
export function monthStart(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`
}

/** 'Jan 2027' */
export function formatMonthYear(date: LocalDate): string {
  const [y, m] = date.split('-').map(Number)
  return format(new Date(y, m - 1, 1), 'MMM yyyy', { locale: localeId })
}
