/**
 * Definisi preset (template materi). Data sistem, bukan data keluarga.
 *
 * File di folder ini harus bisa dijalankan langsung oleh Node (dipakai
 * `scripts/seed-presets.ts`), jadi: import relatif dengan ekstensi `.ts`,
 * tanpa alias `@/`, dan tanpa dependency runtime.
 */
import type { Structure } from '../enums.ts'

export type PresetUnitDef = {
  /**
   * Kunci stabil di dalam preset. Dipakai untuk membentuk id
   * `pu_<code>_<key>`, jadi JANGAN diubah setelah dirilis.
   */
  key: string
  label: string
  /** Wajib untuk preset `range` (jumlah ayat/halaman). */
  size?: number
  /** Sub-topik (hanya untuk `checklist`). */
  children?: PresetUnitDef[]
}

export type PresetDef = {
  /** Kunci stabil preset, juga dipakai untuk id `preset_<code>`. */
  code: string
  name: string
  structure: Structure
  unitLabel?: string
  units: PresetUnitDef[]
}
