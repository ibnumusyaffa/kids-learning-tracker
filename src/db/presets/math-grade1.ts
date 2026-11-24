import type { PresetDef } from './types.ts'

/**
 * Matematika Kelas 1 (Kurikulum Merdeka, Fase A).
 *
 * Topik diturunkan dari elemen Capaian Pembelajaran Matematika Fase A
 * (Bilangan, Aljabar, Pengukuran, Geometri, Analisis Data), dipilih yang
 * lazim untuk kelas 1. Bukan daftar bab buku tertentu; urutan bab tiap
 * penerbit/sekolah bisa berbeda. Orang tua bisa menyesuaikan setelah disalin.
 *
 * Jangan ubah `key` setelah rilis (membentuk id preset_units).
 */
export const mathGrade1: PresetDef = {
  code: 'kurmer_mtk_kelas1',
  name: 'Matematika Kelas 1',
  structure: 'checklist',
  units: [
    {
      key: 'bilangan',
      label: 'Bilangan',
      children: [
        { key: 'bil-1-10', label: 'Membilang, membaca & menulis 1–10' },
        { key: 'bil-11-20', label: 'Membilang, membaca & menulis 11–20' },
        { key: 'bil-banding', label: 'Membandingkan & mengurutkan bilangan sampai 20' },
        { key: 'bil-urai', label: 'Menyusun & mengurai bilangan (mis. 7 = 5 + 2)' },
        { key: 'bil-puluhan', label: 'Puluhan & satuan, bilangan sampai 100' },
      ],
    },
    {
      key: 'operasi',
      label: 'Penjumlahan & Pengurangan',
      children: [
        { key: 'tambah-10', label: 'Penjumlahan sampai 10' },
        { key: 'kurang-10', label: 'Pengurangan sampai 10' },
        { key: 'tambah-20', label: 'Penjumlahan sampai 20' },
        { key: 'kurang-20', label: 'Pengurangan sampai 20' },
        { key: 'soal-cerita', label: 'Soal cerita penjumlahan & pengurangan' },
      ],
    },
    {
      key: 'aljabar',
      label: 'Aljabar',
      children: [
        { key: 'sama-dengan', label: 'Arti tanda sama dengan (=)' },
        { key: 'pola', label: 'Pola gambar & benda' },
      ],
    },
    {
      key: 'geometri',
      label: 'Geometri',
      children: [
        { key: 'bangun-datar', label: 'Mengenal bangun datar' },
        { key: 'bangun-ruang', label: 'Mengenal bangun ruang' },
        { key: 'susun-bangun', label: 'Menyusun & mengurai bangun datar' },
        { key: 'posisi', label: 'Posisi benda (atas, bawah, depan, belakang)' },
      ],
    },
    {
      key: 'pengukuran',
      label: 'Pengukuran',
      children: [
        { key: 'panjang', label: 'Membandingkan panjang (satuan tidak baku)' },
        { key: 'berat', label: 'Membandingkan berat (satuan tidak baku)' },
      ],
    },
    {
      key: 'data',
      label: 'Analisis Data',
      children: [
        { key: 'kelompok', label: 'Menyortir & mengelompokkan benda' },
        { key: 'piktogram', label: 'Menyajikan data dengan turus & piktogram' },
      ],
    },
  ],
}
