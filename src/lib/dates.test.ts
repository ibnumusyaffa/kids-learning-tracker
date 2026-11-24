import { describe, expect, it } from 'vitest'
import { ageOf, formatAge } from './dates'

describe('umur', () => {
  it('menghitung tahun & bulan, belum ulang tahun bulan ini', () => {
    expect(ageOf('2018-03-14', '2026-11-24')).toEqual({ years: 8, months: 8 })
    expect(ageOf('2018-11-25', '2026-11-24')).toEqual({ years: 7, months: 11 })
    expect(ageOf('2018-11-24', '2026-11-24')).toEqual({ years: 8, months: 0 })
  })

  it('format panjang & pendek', () => {
    expect(formatAge('2018-03-14', '2026-11-24')).toBe('8 tahun 8 bulan')
    expect(formatAge('2018-03-14', '2026-11-24', true)).toBe('8 tahun')
    expect(formatAge('2018-11-24', '2026-11-24')).toBe('8 tahun')
    expect(formatAge('2026-01-10', '2026-11-24')).toBe('10 bulan')
    expect(formatAge('2026-11-20', '2026-11-24')).toBe('baru lahir')
  })

  it('tanggal kosong, tidak valid, atau di masa depan → null', () => {
    expect(formatAge(null, '2026-11-24')).toBeNull()
    expect(formatAge('2027-01-01', '2026-11-24')).toBeNull()
    expect(formatAge('14/03/2018', '2026-11-24')).toBeNull()
  })
})
