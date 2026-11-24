/**
 * Label UI & default per bentuk materi / preset. Aman dipakai di client.
 * Lihat docs.md bagian 3.
 */
import type {
  MasteryLevel,
  Structure,
  SuggestOrder,
} from '@/db/enums'

export const STRUCTURE_META: Record<
  Structure,
  { label: string; emoji: string; description: string }
> = {
  range: {
    label: 'Maju per halaman/ayat',
    emoji: '📖',
    description: 'Materi berurutan dan punya ukuran. Contoh: hafalan Quran, Iqra, buku.',
  },
  checklist: {
    label: 'Daftar topik',
    emoji: '✅',
    description: 'Topik lepas dengan level penguasaan. Contoh: Matematika, vocab, doa.',
  },
  none: {
    label: 'Kebiasaan harian',
    emoji: '📅',
    description: 'Tanpa daftar materi, yang dihitung rajinnya. Contoh: baca buku, olahraga.',
  },
}

export const MASTERY_META: Record<
  MasteryLevel,
  { label: string; dots: number }
> = {
  belum: { label: 'Belum', dots: 0 },
  kenal: { label: 'Kenal', dots: 1 },
  bisa: { label: 'Bisa', dots: 2 },
  mahir: { label: 'Mahir', dots: 3 },
}

export const SUGGEST_ORDER_META: Record<SuggestOrder, string> = {
  asc: 'Maju (dari awal daftar)',
  desc: 'Mundur (dari akhir daftar)',
  manual: 'Pilih sendiri',
}

/** Default saat membuat pelajaran dari preset tertentu. */
export const PRESET_DEFAULTS: Record<
  string,
  { suggestOrder: SuggestOrder; categoryName?: string }
> = {
  quran_juz30: { suggestOrder: 'desc', categoryName: 'Quran' },
  kurmer_mtk_kelas1: { suggestOrder: 'asc', categoryName: 'Sekolah' },
}
