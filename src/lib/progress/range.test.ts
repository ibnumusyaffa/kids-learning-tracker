import { describe, expect, it } from 'vitest'
import { coveredCount, gaps, isComplete, mergeTouches, rangeProgress } from './range'

describe('range progress', () => {
  it('menghitung ayat unik, bukan ayat terbesar', () => {
    // An-Nazi'at 46 ayat: ayat 1-5 lalu 11-15
    const touches = [
      { from: 1, to: 5 },
      { from: 11, to: 15 },
    ]
    expect(coveredCount(46, touches)).toBe(10)
    expect(rangeProgress(46, touches).percent).toBe(22)
  })

  it('null berarti seluruh materi', () => {
    expect(coveredCount(4, [{ from: null, to: null }])).toBe(4)
    expect(isComplete(4, [{ from: null, to: null }])).toBe(true)
  })

  it('menggabungkan interval yang tumpang tindih dan bersebelahan', () => {
    expect(
      mergeTouches(40, [
        { from: 10, to: 20 },
        { from: 1, to: 5 },
        { from: 6, to: 9 },
        { from: 15, to: 25 },
      ]),
    ).toEqual([[1, 25]])
  })

  it('memotong sentuhan di luar ukuran materi', () => {
    expect(coveredCount(7, [{ from: 5, to: 99 }])).toBe(3)
  })

  it('murajaah ulang tidak menambah progres', () => {
    const touches = [
      { from: 1, to: 10 },
      { from: 1, to: 10 },
    ]
    expect(coveredCount(40, touches)).toBe(10)
  })

  it('memberi celah pertama sebagai saran lanjut', () => {
    const touches = [
      { from: 1, to: 5 },
      { from: 11, to: 15 },
    ]
    expect(gaps(46, touches)).toEqual([
      [6, 10],
      [16, 46],
    ])
    expect(rangeProgress(46, touches).nextGap).toEqual([6, 10])
    expect(rangeProgress(4, [{ from: null, to: null }]).nextGap).toBeNull()
  })

  it('materi kosong tidak pernah selesai', () => {
    expect(rangeProgress(0, []).complete).toBe(false)
  })
})
