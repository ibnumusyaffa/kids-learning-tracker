# TODO

Rencana kerja berdasarkan [docs.md](./docs.md). Urutan milestone = urutan pengerjaan.

## ✅ M0 — Fondasi (selesai)

- [x] Scaffold TanStack Start + Cloudflare Workers
- [x] Binding D1 (`DB`) dan R2 (`BUCKET`) di `wrangler.jsonc`
- [x] Schema Drizzle (22 tabel) + migrasi awal
- [x] Seed preset Juz 30 (37 surah, 564 ayat) — seeder terpisah `pnpm db:seed:presets` (data di `src/db/presets/`)
- [x] better-auth: email/password + Google, plugin organization (keluarga) dengan `timezone`
- [x] `familyMiddleware` untuk isolasi data keluarga
- [x] Halaman login/daftar, buat keluarga, layout app (nav bawah mobile, header desktop)
- [x] Profil anak: daftar + tambah
- [x] Logika progres range (ayat unik, celah berikutnya) + streak + tanggal lokal, dengan unit test
- [x] shadcn/ui + tema

## ✅ M1 — Pelajaran & materi (selesai, kecuali preset Iqra)

- [x] Halaman detail anak (`/children/$childId`) berisi daftar pelajaran, dikelompokkan per kategori, dengan ringkasan progres
- [x] Buat pelajaran dari preset (salin `preset_units` → `units`, insert dipecah karena batas 100 parameter D1)
- [x] Buat pelajaran custom: pilih bentuk materi dengan label ramah ("📖 Maju per halaman/ayat", "✅ Daftar topik", "📅 Kebiasaan harian")
- [x] Pilih kategori, `unit_label`, `open_ended`, `suggest_order`, `activity_kinds` (default dari preset: Juz 30 → ziyadah/murajaah, urutan mundur, kategori Quran)
- [x] Halaman detail pelajaran: daftar materi sesuai bentuk
  - [x] range: progres per materi (ayat unik / ukuran), status selesai/sedang
  - [x] checklist: level per topik, hierarki `parent_id`
  - [x] none: tidak ada daftar materi
- [x] Tambah / edit / arsip materi (arsip ikut sub-topik); urutkan dengan tombol naik/turun
- [x] Ubah level topik langsung dari halaman materi; tandai selesai manual untuk range
- [x] Kunci `structure` setelah pelajaran punya log (`STRUCTURE_LOCKED`)
- [x] Edit & arsip profil anak
- [x] Halaman 404 & error yang ramah; data keluarga lain → 404
- [ ] Preset Iqra 1–6 (**menunggu jumlah halaman per jilid**)

## ✅ M2 — Catat log (selesai)

- [x] Server function `createLog` (log + materi baru + log_items + hitung ulang level dalam satu batch D1)
- [x] Validasi per bentuk materi (`src/lib/log-rules.ts` + test): range `1 <= from <= to <= size`, checklist tanpa topik dobel, benar ≤ total, kebiasaan tanpa materi, tanggal tidak boleh masa depan
- [x] Cache `units.mastery` = level dari log terbaru (tanggal, lalu waktu dibuat); log lama tidak menimpa; edit/hapus log menghitung ulang
- [x] Form log sesuai bentuk materi
  - [x] range: pilih materi (default: saran lanjut / materi berikutnya sesuai `suggest_order`), rentang opsional (kosong = seluruh), level opsional
  - [x] checklist: pilih topik, level (default level sekarang), benar/total opsional
  - [x] none: cukup tanggal, menit, catatan
  - [x] open_ended: tambah materi baru langsung dari form log (vocab: kata + arti; buku: judul + jumlah halaman)
  - [x] Beberapa materi dalam satu catatan (mis. murajaah 2 surah)
- [x] Field umum: tanggal (default hari ini sesuai timezone keluarga), jenis kegiatan, durasi, kualitas, mood, catatan, `measure`
- [x] Riwayat log per pelajaran (terbaru dulu, "Muat lagi" per 20); edit & hapus log
- [x] Upload foto ke R2 (maks 6 per catatan, 5 MB, hanya webp/jpeg/png)
  - [x] Kompres di browser (WebP, maks 1600px)
  - [x] `/api/files/$attachmentId` mengecek session + keluarga (401 tanpa login, 404 untuk keluarga lain); bucket tetap privat
  - [x] Hapus log/foto → objek R2 ikut dihapus

## ✅ M3 — Layar "Hari Ini" (selesai; fitur Todo kemudian dihapus 24 Nov 2026)

- [x] Todo: rutin (`daily`, `weekly:mon,wed`) dan sekali (tenggat opsional); kelola di halaman anak (tambah/edit/arsip) dan tambah cepat dari Hari Ini
- [x] Hitung todo yang jatuh hari ini per anak (`src/lib/recurrence.ts` + test): rutin sesuai hari; sekali tampil sampai selesai, mulai 7 hari sebelum tenggat
- [x] Saran otomatis (`src/server/today.server.ts`)
  - [x] range: lanjut dari celah pertama materi yang sedang berjalan
  - [x] materi baru sesuai `suggest_order`
  - [x] perlu diulang (`src/lib/review.ts` + test): kualitas terakhir `ulang`/`belum`, atau ≥14 hari tidak disentuh (pelajaran dengan kegiatan murajaah)
  - [x] murajaah hari ini tidak menyembunyikan saran hafalan baru
- [x] Centang todo bermateri → form catat terisi sebagian (materi, rentang, jenis kegiatan) → simpan jadi log + `todo_completions` dalam satu batch
- [x] Centang langsung tanpa form untuk todo umum & kebiasaan (`none`, sekaligus membuat log)
- [x] Batal centang (log terkait ikut dihapus, dengan konfirmasi)
- [x] Kebiasaan tanpa todo tetap muncul sebagai centang harian
- [x] Indikator progres per anak (2/5 ✓) dan tenggat (lewat tenggat / hari ini / ⚠ besok)

## ✅ M4 — Target & statistik (selesai; fitur Target kemudian dihapus 24 Nov 2026)

- [x] CRUD target di halaman pelajaran (metric, period, goal, deadline, `min_mastery`, cakupan materi `target_units`)
- [x] Hitung progres target per metric (`src/lib/target-progress.ts` + test): `units_completed`, `minutes`, `sessions` (harian/mingguan/bulanan/total), `streak`, `score` (nilai terakhir, dinormalisasi ke 100)
- [x] Proyeksi selesai berdasarkan pace (sesuai jadwal / tertinggal / lewat batas)
- [x] `achieved_at` dicatat saat target total tercapai (target periodik tidak)
- [x] Halaman statistik anak (`/children/$childId/stats`)
  - [x] Heatmap aktivitas 18 minggu (level dari menit belajar)
  - [x] Streak sekarang & terpanjang, hari aktif 30 hari, menit minggu ini
  - [x] Menit per pelajaran (minggu ini & 30 hari)
  - [x] Peta hafalan / materi range (warna sesuai % ayat/halaman)
  - [x] Level topik & akurasi latihan (30 hari vs 30 hari sebelumnya)
  - [x] Tren nilai per pelajaran
- [x] Assessment: input nilai angka atau huruf + setara angka, nilai maksimal, grafik tren dengan garis target
- [x] Ramp warna grafik satu hue, divalidasi (terang & gelap) dengan `validate_palette.js --ordinal`
- [x] Seeder data demo `pnpm db:seed:dev` (login `demo@kids.test` / `password123`, ±8 minggu log)

## M5 — Siap rilis

- [~] Layanan email (verifikasi, reset password) — **ditunda** (keputusan 23 Nov 2026); sementara akun email/password tidak bisa reset sendiri, login Google jadi cadangan
- [~] Lupa password — ditunda bersama email
- [x] PWA: manifest, ikon (192/512/maskable, apple-touch), service worker dasar (aset cache-first, halaman network-first + fallback `/offline`; API & foto tidak di-cache), hanya aktif di production
- [x] Halaman error & not found
- [x] Loading state (skeleton) bawaan router untuk loader lambat; empty state di setiap daftar
- [x] Setup Cloudflare production (23 Nov 2026): D1 `kids-tracker` (APAC), R2 `kids-tracker-uploads` (APAC, akses publik mati), migrasi + seed preset, 4 secrets, deploy → https://kids-tracker.ibnu-musyaffa.workers.dev; smoke test lolos, data tes sudah dihapus
- [x] Google OAuth lokal: alur sampai redirect ke Google terverifikasi (client_id, redirect_uri, PKCE)
- [ ] Google OAuth production: tambah redirect URI `https://kids-tracker.ibnu-musyaffa.workers.dev/api/auth/callback/google` di Google Cloud Console (**perlu dilakukan pemilik akun Google**)
- [x] GitHub Actions (`.github/workflows/ci.yml`): typecheck + test + build; deploy dari `main` (migrasi D1 + seed preset + deploy) — butuh secrets `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` dan remote GitHub
- [x] Export data keluarga: `/api/export` (JSON lengkap) & `/api/export?format=csv` (catatan, aman dari formula injection) dari menu akun

## Penyederhanaan (24 Nov 2026)

- [x] Hapus permanen: jenis kegiatan (`logs.activity_kind`, `subjects.activity_kinds`), kualitas (`logs.quality`), ukuran (`logs.measure_*`), fitur nilai (`assessments`, `assessment_units`, target `score`) — migrasi `0001_simplify_log` (ditulis manual: D1 mengabaikan `PRAGMA foreign_keys=OFF`, jadi tabel anak di-backup & dipulihkan)
- [x] "Perlu diulang" kini dari level materi (belum/kenal) + range yang ≥14 hari tidak disentuh
- [x] Saran lanjut disembunyikan hanya kalau materi yang disarankan sudah dicatat hari ini
- [x] Migrasi production + deploy (24 Nov 2026), smoke test lolos
- [x] Hapus benar/soal (`log_items.correct/total`) + akurasi latihan di statistik — migrasi `0002_drop_log_score`
- [x] Default form catat: durasi & mood dari catatan terakhir pelajaran (fallback 15 menit, 🙂), level = level materi (fallback Kenal); pilihan level selalu 4 tombol
- [x] Deploy default form catat ke production (24 Nov 2026)
- [x] Hapus seluruh fitur Todo (rutin & sekali): halaman anak, Hari Ini, `todos`, `todo_completions` — migrasi `0003_drop_todos`; Hari Ini = kebiasaan + saran
- [x] Deploy hapus Todo ke production (24 Nov 2026)
- [x] Hapus fitur Target (`targets`, `target_units`, form & kartu target, target di statistik) — migrasi `0004_drop_targets`; diganti baris otomatis "±N ayat/minggu → perkiraan selesai ~bulan" untuk pelajaran range (`src/lib/progress/pace.ts` + test)
- [x] Deploy hapus Target ke production (24 Nov 2026)

## Fase 2

- [ ] Undang pasangan ke keluarga (invitation better-auth + email)
- [ ] Penjadwal murajaah (spaced repetition)
- [ ] Reward / poin bintang
- [ ] Milestone & achievement
- [ ] Laporan mingguan/bulanan (share/PDF)
- [ ] Template kurikulum (Kurikulum Merdeka per kelas) — ✅ Matematika Kelas 1 (24 Nov 2026, dari CP Fase A); kelas & mapel lain menyusul
- [ ] Mode kuis/flashcard untuk vocab
- [ ] Catatan kesalahan ayat
- [ ] Putaran khatam (`current_cycle`) untuk tilawah
- [ ] Mode offline
- [ ] Error tracking (Sentry)

## Tech debt / catatan

- [ ] Test UI di browser (form & dialog M0–M2 baru dites lewat HTTP ke server function + render SSR; logika form log, layar Hari Ini, form target/nilai, dan grafik belum diklik/dilihat di browser)
- [ ] Pindahkan smoke test HTTP (server function) ke repo sebagai `scripts/smoke` atau test integrasi
- [ ] Urutkan materi dengan drag & drop (sekarang tombol naik/turun)
- [ ] Hapus anak/pelajaran permanen beserta foto R2 (sekarang hanya arsip)
- [ ] Tes integrasi server function dengan D1 lokal (vitest + `@cloudflare/vitest-pool-workers`)
- [ ] Bundle `family.server` ~1.1 MB (server); cek apakah bisa diperkecil
- [ ] Integrasi TanStack Query (sekarang masih `router.invalidate()`)
- [ ] Statistik dihitung saat dibaca (scan semua log anak); kalau data sudah bertahun-tahun, pertimbangkan agregat harian
- [ ] Commit awal repo + remote GitHub (syarat CI/deploy otomatis)

## Menunggu keputusan

- [ ] Jumlah halaman Iqra jilid 1–6 (sesuai buku yang dipakai)
- [ ] Provider email (Resend atau lainnya)
- [ ] Kapan surah dianggap "hafal": otomatis, manual, atau keduanya
- [ ] Skala level global atau custom per pelajaran
- [ ] Rentang usia anak (TK–SD atau sampai SMP)
- [ ] Satu user boleh ikut beberapa keluarga (kakek/nenek)?
