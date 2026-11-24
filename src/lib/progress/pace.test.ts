import { describe, expect, it } from 'vitest'
import { rangePace } from './pace'

const today = '2026-11-24'

describe('rangePace', () => {
  it('kecepatan dari 28 hari terakhir dan perkiraan selesai', () => {
    // 40 ayat; 10 ayat lama (sebelum jendela), 28 ayat dalam 28 hari terakhir → 1 ayat/hari
    const p = rangePace(
      [
        {
          size: 40,
          completed: false,
          touches: [
            { from: 1, to: 10, date: '2026-10-01' },
            { from: 11, to: 38, date: '2026-11-20' },
          ],
        },
      ],
      today,
    )
    expect(p).toMatchObject({ covered: 38, total: 40, perWeek: 7, done: false, eta: '2026-11-26' })
  })

  it('ulangan ayat lama tidak dihitung sebagai kemajuan', () => {
    const p = rangePace(
      [{ size: 10, completed: false, touches: [{ from: 1, to: 5, date: '2026-10-01' }, { from: 1, to: 5, date: '2026-11-23' }] }],
      today,
    )
    expect(p).toMatchObject({ covered: 5, perWeek: 0, eta: null, done: false })
  })

  it('selesai manual dihitung penuh, semua selesai → tanpa perkiraan', () => {
    const p = rangePace(
      [
        { size: 6, completed: true, touches: [] },
        { size: 4, completed: false, touches: [{ from: null, to: null, date: '2026-11-20' }] },
      ],
      today,
    )
    expect(p).toMatchObject({ covered: 10, total: 10, done: true, eta: null })
  })
})
