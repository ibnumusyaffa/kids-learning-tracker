import { describe, expect, it } from 'vitest'
import { normalizeLogItems } from './log-rules'
import { suggestRange } from './suggest'

const units = new Map([
  ['naba', { size: 40 }],
  ['ikhlas', { size: 4 }],
  ['kali', { size: null }],
])
const range = { structure: 'range' as const, openEnded: false }
const checklist = { structure: 'checklist' as const, openEnded: false }

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as Error).message
  }
  return 'OK'
}

describe('normalizeLogItems', () => {
  it('range: rentang opsional, kosong = seluruh materi', () => {
    const items = normalizeLogItems(range, units, [
      { unitId: 'naba', rangeFrom: 11, rangeTo: 20 },
      { unitId: 'ikhlas' },
    ])
    expect(items[0]).toMatchObject({ rangeFrom: 11, rangeTo: 20 })
    expect(items[1]).toMatchObject({ rangeFrom: null, rangeTo: null })
  })

  it('range: menolak rentang tidak lengkap / di luar ukuran', () => {
    expect(code(() => normalizeLogItems(range, units, [{ unitId: 'naba', rangeFrom: 5 }]))).toBe(
      'RANGE_INCOMPLETE#0',
    )
    expect(
      code(() => normalizeLogItems(range, units, [{ unitId: 'naba', rangeFrom: 30, rangeTo: 41 }])),
    ).toBe('RANGE_OUT_OF_BOUNDS#0')
    expect(
      code(() => normalizeLogItems(range, units, [{ unitId: 'naba', rangeFrom: 9, rangeTo: 3 }])),
    ).toBe('RANGE_OUT_OF_BOUNDS#0')
    expect(
      code(() => normalizeLogItems(range, units, [{ unitId: 'naba', rangeFrom: 0, rangeTo: 3 }])),
    ).toBe('RANGE_OUT_OF_BOUNDS#0')
  })

  it('range: materi yang sama boleh dua kali (dua rentang)', () => {
    expect(
      normalizeLogItems(range, units, [
        { unitId: 'naba', rangeFrom: 1, rangeTo: 5 },
        { unitId: 'naba', rangeFrom: 20, rangeTo: 25 },
      ]),
    ).toHaveLength(2)
  })

  it('checklist: buang rentang, tolak topik dobel', () => {
    const [item] = normalizeLogItems(checklist, units, [
      { unitId: 'kali', rangeFrom: 1, rangeTo: 2, masteryAfter: 'kenal' },
    ])
    expect(item).toMatchObject({ rangeFrom: null, rangeTo: null, masteryAfter: 'kenal' })
    expect(
      code(() => normalizeLogItems(checklist, units, [{ unitId: 'kali' }, { unitId: 'kali' }])),
    ).toBe('DUPLICATE_UNIT#1')
  })

  it('none: tanpa materi', () => {
    expect(normalizeLogItems({ structure: 'none', openEnded: false }, units, [])).toEqual([])
    expect(
      code(() =>
        normalizeLogItems({ structure: 'none', openEnded: false }, units, [{ unitId: 'kali' }]),
      ),
    ).toBe('NO_ITEMS_FOR_HABIT')
  })

  it('wajib minimal satu materi untuk range/checklist', () => {
    expect(code(() => normalizeLogItems(range, units, []))).toBe('ITEMS_REQUIRED')
  })

  it('materi baru hanya untuk open_ended', () => {
    expect(
      code(() => normalizeLogItems(checklist, units, [{ newUnit: { label: 'spoon' } }])),
    ).toBe('NOT_OPEN_ENDED#0')

    const [item] = normalizeLogItems({ structure: 'checklist', openEnded: true }, units, [
      { newUnit: { label: ' spoon ', meaning: 'sendok', tags: ['rumah', ' '] }, masteryAfter: 'kenal' },
    ])
    expect(item.unit).toEqual({
      kind: 'new',
      label: 'spoon',
      meaning: 'sendok',
      tags: ['rumah'],
      size: null,
    })
  })

  it('materi baru range wajib punya ukuran dan rentang dicek terhadapnya', () => {
    const openRange = { structure: 'range' as const, openEnded: true }
    expect(code(() => normalizeLogItems(openRange, units, [{ newUnit: { label: 'Buku' } }]))).toBe(
      'SIZE_REQUIRED#0',
    )
    expect(
      code(() =>
        normalizeLogItems(openRange, units, [
          { newUnit: { label: 'Buku', size: 50 }, rangeFrom: 1, rangeTo: 60 },
        ]),
      ),
    ).toBe('RANGE_OUT_OF_BOUNDS#0')
  })

  it('menolak unit asing dan item tanpa unit', () => {
    expect(code(() => normalizeLogItems(range, units, [{ unitId: 'lain' }]))).toBe(
      'UNIT_NOT_FOUND#0',
    )
    expect(code(() => normalizeLogItems(range, units, [{}]))).toBe('UNIT_REQUIRED#0')
  })
})

describe('suggestRange', () => {
  const u = (
    id: string,
    sortOrder: number,
    covered = 0,
    done = false,
    nextGap: [number, number] | null = null,
  ) => ({ id, sortOrder, progress: { covered, done, nextGap } })

  it('lanjutkan materi yang sedang berjalan dari celah pertama', () => {
    const s = suggestRange([u('a', 1, 40, true), u('b', 2, 10, false, [11, 46]), u('c', 3)], 'asc')
    expect(s).toEqual({ unitId: 'b', from: 11, to: 46, reason: 'continue' })
  })

  it('materi baru mengikuti urutan', () => {
    const list = [u('naba', 78), u('ikhlas', 112), u('nas', 114, 6, true)]
    expect(suggestRange(list, 'asc')?.unitId).toBe('naba')
    expect(suggestRange(list, 'desc')?.unitId).toBe('ikhlas')
    expect(suggestRange(list, 'manual')).toBeNull()
  })

  it('semua selesai → tidak ada saran', () => {
    expect(suggestRange([u('a', 1, 4, true)], 'asc')).toBeNull()
  })
})
