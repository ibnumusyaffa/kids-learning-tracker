import { describe, expect, it } from 'vitest'
import { PRESETS } from './index.ts'
import { mathGrade1 } from './math-grade1.ts'
import { quranJuz30 } from './quran-juz30.ts'
import { buildPresetSql, flattenUnits } from './sql.ts'
import type { PresetDef } from './types.ts'

describe('preset Juz 30', () => {
  it('berisi 37 surah dan 564 ayat', () => {
    const units = flattenUnits(quranJuz30)
    expect(units).toHaveLength(37)
    expect(units.reduce((n, u) => n + (u.size ?? 0), 0)).toBe(564)
  })

  it('id stabil per surah', () => {
    const units = flattenUnits(quranJuz30)
    expect(units[0]).toMatchObject({ id: 'pu_quran_juz30_078', label: '78. An-Naba', size: 40 })
    expect(units.at(-1)).toMatchObject({ id: 'pu_quran_juz30_114', size: 6 })
  })
})

describe('preset Matematika Kelas 1', () => {
  it('6 elemen, 20 topik, parent sebelum anak', () => {
    const units = flattenUnits(mathGrade1)
    const parents = units.filter((u) => u.parentId === null)
    const leaves = units.filter((u) => u.parentId !== null)
    expect(parents.map((u) => u.label)).toEqual([
      'Bilangan',
      'Penjumlahan & Pengurangan',
      'Aljabar',
      'Geometri',
      'Pengukuran',
      'Analisis Data',
    ])
    expect(leaves).toHaveLength(20)
    const pos = new Map(units.map((u, i) => [u.id, i]))
    expect(leaves.every((u) => pos.get(u.parentId!)! < pos.get(u.id)!)).toBe(true)
    expect(units.every((u) => u.size === null)).toBe(true)
  })
})

describe('semua preset', () => {
  it('valid dan bisa dijadikan SQL', () => {
    expect(() => buildPresetSql(PRESETS)).not.toThrow()
  })
})

describe('buildPresetSql', () => {
  const base: PresetDef = {
    code: 'tes',
    name: "Doa Nabi Yunus 'as",
    structure: 'checklist',
    units: [
      { key: 'a', label: 'Topik A', children: [{ key: 'a1', label: 'Sub A1' }] },
      { key: 'b', label: 'Topik B' },
    ],
  }

  it('parent selalu sebelum anaknya', () => {
    const units = flattenUnits(base)
    expect(units.map((u) => u.id)).toEqual(['pu_tes_a', 'pu_tes_a1', 'pu_tes_b'])
    expect(units[1].parentId).toBe('pu_tes_a')
  })

  it('upsert, hapus unit yang sudah tidak ada, dan escape kutip', () => {
    const sql = buildPresetSql([base])
    expect(sql).toContain("'Doa Nabi Yunus ''as'")
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE')
    expect(sql).toContain(
      "DELETE FROM preset_units WHERE preset_id = 'preset_tes' AND id NOT IN ('pu_tes_a', 'pu_tes_a1', 'pu_tes_b');",
    )
  })

  it('menolak definisi yang salah', () => {
    expect(() =>
      flattenUnits({ ...base, units: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A lagi' }] }),
    ).toThrow(/duplikat/)
    expect(() =>
      flattenUnits({ code: 'r', name: 'R', structure: 'range', units: [{ key: 'x', label: 'X' }] }),
    ).toThrow(/size/)
    expect(() => buildPresetSql([base, base])).toThrow(/duplikat/)
    expect(() => flattenUnits({ ...base, code: 'Bad Code' })).toThrow(/tidak valid/)
  })
})
