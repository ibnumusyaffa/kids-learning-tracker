import { mathGrade1 } from './math-grade1.ts'
import { quranJuz30 } from './quran-juz30.ts'
import type { PresetDef } from './types.ts'

export type { PresetDef, PresetUnitDef } from './types.ts'

/** Semua preset yang di-seed. Tambah preset baru di sini. */
export const PRESETS: PresetDef[] = [quranJuz30, mathGrade1]
