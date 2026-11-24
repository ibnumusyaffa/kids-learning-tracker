/**
 * Mengubah definisi preset menjadi SQL upsert untuk D1.
 *
 * Aman dijalankan berkali-kali:
 * - preset & unit di-upsert berdasarkan id deterministik
 *   (`preset_<code>`, `pu_<code>_<key>`)
 * - unit yang sudah dihapus dari definisi ikut dihapus dari `preset_units`
 *
 * Pelajaran anak memakai SALINAN unit (`units`), jadi perubahan preset tidak
 * mengubah pelajaran yang sudah ada; hanya berlaku untuk pelajaran baru.
 */
import type { PresetDef, PresetUnitDef } from './types.ts'

export const presetId = (code: string) => `preset_${code}`
export const presetUnitId = (code: string, key: string) => `pu_${code}_${key}`

type FlatUnit = {
  id: string
  parentId: string | null
  label: string
  size: number | null
  sortOrder: number
}

const KEY_RE = /^[a-z0-9_-]+$/

/** Ratakan pohon unit (parent selalu sebelum anaknya) + validasi. */
export function flattenUnits(preset: PresetDef): FlatUnit[] {
  if (!KEY_RE.test(preset.code)) {
    throw new Error(`Kode preset tidak valid: ${preset.code}`)
  }
  const result: FlatUnit[] = []
  const seen = new Set<string>()
  let order = 0

  const walk = (units: PresetUnitDef[], parentId: string | null) => {
    for (const u of units) {
      if (!KEY_RE.test(u.key)) {
        throw new Error(`[${preset.code}] key tidak valid: ${u.key}`)
      }
      const id = presetUnitId(preset.code, u.key)
      if (seen.has(id)) throw new Error(`[${preset.code}] key duplikat: ${u.key}`)
      seen.add(id)

      if (preset.structure === 'range' && !(u.size && u.size > 0)) {
        throw new Error(`[${preset.code}] ${u.label}: range wajib punya size > 0`)
      }
      if (u.children?.length && preset.structure !== 'checklist') {
        throw new Error(`[${preset.code}] ${u.label}: sub-topik hanya untuk checklist`)
      }

      result.push({
        id,
        parentId,
        label: u.label,
        size: preset.structure === 'range' ? (u.size ?? null) : null,
        sortOrder: ++order,
      })
      if (u.children) walk(u.children, id)
    }
  }

  if (preset.structure === 'none' && preset.units.length > 0) {
    throw new Error(`[${preset.code}] preset kebiasaan tidak punya materi`)
  }
  walk(preset.units, null)
  return result
}

const str = (v: string | null | undefined) =>
  v === null || v === undefined ? 'NULL' : `'${v.replaceAll("'", "''")}'`
const num = (v: number | null) => (v === null ? 'NULL' : String(Math.trunc(v)))

export function buildPresetSql(presets: PresetDef[]): string {
  const codes = new Set<string>()
  const lines: string[] = ['-- Di-generate oleh scripts/seed-presets.ts. Jangan diedit.']

  for (const preset of presets) {
    if (codes.has(preset.code)) throw new Error(`Kode preset duplikat: ${preset.code}`)
    codes.add(preset.code)

    const pid = presetId(preset.code)
    const units = flattenUnits(preset)

    lines.push(
      `INSERT INTO presets (id, code, name, structure, unit_label) VALUES ` +
        `(${str(pid)}, ${str(preset.code)}, ${str(preset.name)}, ${str(preset.structure)}, ${str(preset.unitLabel)}) ` +
        `ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name, ` +
        `structure = excluded.structure, unit_label = excluded.unit_label;`,
    )

    const keep = units.map((u) => str(u.id)).join(', ')
    lines.push(
      `DELETE FROM preset_units WHERE preset_id = ${str(pid)}` +
        (keep ? ` AND id NOT IN (${keep});` : ';'),
    )

    for (const u of units) {
      lines.push(
        `INSERT INTO preset_units (id, preset_id, parent_id, label, size, sort_order) VALUES ` +
          `(${str(u.id)}, ${str(pid)}, ${str(u.parentId)}, ${str(u.label)}, ${num(u.size)}, ${u.sortOrder}) ` +
          `ON CONFLICT(id) DO UPDATE SET parent_id = excluded.parent_id, label = excluded.label, ` +
          `size = excluded.size, sort_order = excluded.sort_order;`,
      )
    }
  }
  return `${lines.join('\n')}\n`
}
