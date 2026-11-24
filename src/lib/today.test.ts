import { describe, expect, it } from 'vitest'
import { reviewCandidates } from './review'

describe('reviewCandidates', () => {
  const today = '2026-11-23'
  const u = (id: string, last: { date: string; mastery: 'belum' | 'kenal' | 'bisa' | 'mahir' | null } | null, started = true) => ({
    id,
    label: id,
    sortOrder: 0,
    started,
    last,
  })

  it('level lemah (belum/kenal) dulu, lalu yang lama tidak diulang', () => {
    const list = reviewCandidates(
      [
        u('naba', { date: '2026-11-21', mastery: 'kenal' }),
        u('takwir', { date: '2026-11-01', mastery: 'mahir' }),
        u('nas', { date: '2026-11-20', mastery: null }),
        u('falaq', { date: '2026-11-10', mastery: 'belum' }),
      ],
      today,
    )
    expect(list.map((c) => `${c.unitId}:${c.reason}:${c.days}`)).toEqual([
      'falaq:weak:13',
      'naba:weak:2',
      'takwir:stale:22',
    ])
  })

  it('abaikan yang sudah disentuh hari ini, belum pernah, atau di luar batas', () => {
    expect(reviewCandidates([u('a', { date: today, mastery: 'kenal' })], today)).toEqual([])
    expect(reviewCandidates([u('b', null)], today)).toEqual([])
    expect(
      reviewCandidates([u('c', { date: '2026-10-01', mastery: 'bisa' })], today, {
        includeStale: false,
      }),
    ).toEqual([])
    const many = Array.from({ length: 5 }, (_, i) => u(`x${i}`, { date: '2026-11-01', mastery: 'kenal' }))
    expect(reviewCandidates(many, today, { limit: 3 })).toHaveLength(3)
  })
})
