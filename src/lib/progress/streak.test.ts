import { describe, expect, it } from 'vitest'
import { todayIn } from '@/lib/dates'
import { currentStreak, longestStreak } from './streak'

describe('streak', () => {
  const dates = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']

  it('berakhir hari ini', () => {
    expect(currentStreak([...dates, '2026-11-22'], '2026-11-22')).toBe(5)
  })

  it('belum putus kalau hari ini belum dicatat', () => {
    expect(currentStreak(dates, '2026-11-22')).toBe(4)
  })

  it('putus kalau kemarin kosong', () => {
    expect(currentStreak(dates, '2026-11-23')).toBe(0)
  })

  it('melewati pergantian bulan', () => {
    expect(currentStreak(['2026-10-31', '2026-11-01'], '2026-11-01')).toBe(2)
  })

  it('menghitung streak terpanjang', () => {
    expect(
      longestStreak(['2026-11-01', '2026-11-02', '2026-11-05', ...dates]),
    ).toBe(4)
  })
})

describe('todayIn', () => {
  it('memakai zona waktu keluarga, bukan UTC', () => {
    // 22 Nov 23:30 UTC = 23 Nov 06:30 WIB
    const now = new Date('2026-11-22T23:30:00Z')
    expect(todayIn('Asia/Jakarta', now)).toBe('2026-11-23')
    expect(todayIn('UTC', now)).toBe('2026-11-22')
  })
})
