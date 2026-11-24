# Kids Tracker — Rencana Proses Bisnis

Status: draft hasil brainstorming (22 Nov 2026).

> **Perubahan 24 Nov 2026 (penyederhanaan):** jenis kegiatan, kualitas, ukuran (`measure`), fitur nilai (assessment), serta **benar/soal**, akurasi latihan, **seluruh fitur Todo**, dan **fitur Target** **dihapus permanen**, termasuk kolom/tabelnya (migrasi `0001_simplify_log` … `0004_drop_targets`). Pengganti target: baris otomatis "±N ayat/minggu → perkiraan selesai ~bulan" untuk pelajaran range, dihitung dari 4 minggu terakhir. Layar Hari Ini kini berisi kebiasaan harian + saran otomatis saja. Murajaah tidak lagi dicatat sebagai jenis kegiatan; "perlu diulang" dihitung dari level materi dan tanggal terakhir disentuh.

Stack: TanStack Start · Cloudflare Workers · D1 · R2 · better-auth · shadcn/ui (detail di bagian 10).

## 1. Ringkasan

Aplikasi untuk orang tua mencatat dan memantau perkembangan belajar anak, baik pelajaran formal (Matematika, IPA, Bahasa Inggris) maupun informal (hafalan Quran, Iqra, doa harian, kebiasaan membaca).

- Pengguna: **hanya orang tua**. Anak tidak login.
- 1 akun keluarga bisa punya **banyak profil anak**.
- Beban harian orang tua: **hanya mencatat log** (target 1–3 menit per hari).

## 2. Konsep utama

Setiap pelajaran ibarat satu buku catatan milik anak, berisi 4 bagian:

```
+------------------+------------------------------------------+
| Bagian           | Isi                                      |
+------------------+------------------------------------------+
| Materi           | apa yang harus dipelajari                |
| Log              | catatan setiap kali belajar              |
+------------------+------------------------------------------+
```


## 3. Bentuk materi (`structure`)

Enum dengan 3 nilai. Setiap bentuk menjawab pertanyaan berbeda:

```
range     -> "Sudah SAMPAI MANA?"
checklist -> "Sudah BISA APA SAJA?"
none      -> "RAJIN atau tidak?"
```

### 3.1 range — maju per halaman/ayat

Analogi: pembatas buku. Materi berurutan dan punya ukuran.

```
Iqra 2 (32 halaman)
hal: 1 ........ 10 ........ 20 ........ 32
     [██████████████████▌               ]
                        ^ sekarang hal 17 (53%)
```

- Isi log: materi + dari–sampai (opsional; kosong = seluruh materi) + level (opsional).
- Progres: jumlah ayat/halaman unik yang tersentuh ÷ ukuran. Materi boleh dikerjakan tidak berurutan.
- Contoh: hafalan Quran (ayat), Iqra (halaman), tilawah, baca buku per judul.

### 3.2 checklist — daftar topik

Analogi: daftar keterampilan di rapor. Topik lepas, tiap topik punya level.

```
Matematika
  Penjumlahan   ● ● ● ●   mahir
  Pengurangan   ● ● ● ○   bisa
  Perkalian     ● ○ ○ ○   kenal
  Pembagian     ○ ○ ○ ○   belum
```

- Skala level: `belum → kenal → bisa → mahir`.
- Isi log: materi + level baru.
- Progres: jumlah topik per level.
- Topik boleh bertingkat (bab → subtopik).
- Contoh: Matematika, IPA, English phonics, vocab, doa harian, hadits.

### 3.3 none — kebiasaan harian

Analogi: kalender yang dicentang.

```
Baca buku 15 menit
  Sen Sel Rab Kam Jum Sab Min
   ✓   ✓   ✓   ✗   ✓   ✓   ✓   -> streak 3 hari
```

- Isi log: tanggal + menit (atau cukup centang).
- Progres: streak, frekuensi, total menit.
- Contoh: baca buku bebas, menggambar, olahraga, sholat 5 waktu.

### 3.4 Cara memilih

```
           Ada materi yang mau dilacak?
                /              \
             tidak              ya
               |                 |
             NONE        Materinya berurutan
                         & punya panjang?
                           /          \
                          ya          tidak
                          |             |
                        RANGE       CHECKLIST
```

Di UI, istilah teknis tidak ditampilkan:

- 📖 Maju per halaman/ayat (`range`)
- ✅ Daftar topik (`checklist`)
- 📅 Kebiasaan harian (`none`)

### 3.5 Atribut tambahan (variasi tanpa menambah enum)

```
+---------------+--------------------+-------------------------------------------+
| Field         | Berlaku untuk      | Kegunaan                                  |
+---------------+--------------------+-------------------------------------------+
| unit_label    | range              | "ayat", "halaman"                         |
| open_ended    | range, checklist   | materi bertambah terus (vocab, doa, buku) |
| cycle         | range              | putaran ke-berapa (khatam ke-2, ke-3)     |
+---------------+--------------------+-------------------------------------------+
```

Enum ke-4 baru ditambahkan kalau ditemukan kegiatan yang tidak masuk ke salah satu dari 3 bentuk ini.

### 3.6 Pemetaan kegiatan

```
+----------------------------+-----------+---------------------------+
| Kegiatan                   | structure | Atribut                   |
+----------------------------+-----------+---------------------------+
| Hafalan Quran              | range     | unit_label: ayat          |
| Iqra                       | range     | unit_label: halaman       |
| Tilawah / khatam           | range     | halaman, cycle            |
| Baca buku per judul        | range     | halaman, open_ended       |
| Matematika, IPA, IPS       | checklist |                           |
| English phonics            | checklist |                           |
| Vocab, doa, hadits         | checklist | open_ended                |
| Les piano (daftar lagu)    | checklist | open_ended                |
| Baca buku bebas            | none      |                           |
| Menggambar / prakarya      | none      | + foto                    |
| Sholat 5 waktu             | none      | centang harian            |
| Renang                     | checklist | daftar gaya + level       |
+----------------------------+-----------+---------------------------+
```

## 4. Entitas

```
Keluarga
 ├─ Orang tua (1..n)
 ├─ Kategori (Quran, Sekolah, Kebiasaan) — untuk pengelompokan di UI
 └─ Anak (1..n)
     └─ Pelajaran (structure, unit_label, open_ended, cycle)
          ├─ Materi (ukuran untuk range, level untuk checklist, parent untuk hierarki)
          └─ Log (tanggal, materi, rentang, level, menit, mood, catatan, foto)
```

## 5. Struktur database

Target: Cloudflare D1 (SQLite), diakses lewat Drizzle ORM. DDL di bawah adalah SQL SQLite sebagai acuan; implementasinya ditulis sebagai schema Drizzle.

### 5.1 Asumsi sementara

Beberapa pertanyaan terbuka (bagian 11) dijawab dengan default berikut supaya skema bisa ditulis. Bisa diubah nanti.

```
+---------------------------+------------------------------------------------+
| Pertanyaan                | Default di skema                               |
+---------------------------+------------------------------------------------+
| Ayah + ibu login terpisah | didukung: keluarga = organization better-auth, |
|                           | anggota diundang lewat invitation              |
| Skala level               | satu skala global (belum/kenal/bisa/mahir)     |
| Level untuk range         | kolom units.mastery boleh dipakai range juga   |
|                           | (hafal vs mutqin), nullable                    |
| Status "hafal" surah      | progres dihitung dari log; units.completed_at  |
|                           | sebagai penanda manual                         |
| Detail ayat/halaman       | opsional di log; kosong = seluruh materi       |
+---------------------------+------------------------------------------------+
```

### 5.2 Konvensi SQLite / D1

SQLite tidak punya tipe enum, array, uuid, atau timestamp. Konvensinya:

```
+--------------------+-----------------------------+------------------------------+
| Kebutuhan          | Tipe SQLite                 | Contoh                       |
+--------------------+-----------------------------+------------------------------+
| id                 | TEXT (UUID)                 | crypto.randomUUID()          |
| enum               | TEXT + CHECK (...)          | structure IN ('range', ...)  |
| array              | TEXT berisi JSON            | units.tags = '["rumah"]'     |
| boolean            | INTEGER 0/1                 | open_ended = 1               |
| waktu kejadian     | INTEGER (unix ms, UTC)      | created_at                   |
| tanggal kalender   | TEXT 'YYYY-MM-DD'           | logs.date = '2026-11-21'     |
+--------------------+-----------------------------+------------------------------+
```

Tanggal kalender (tanggal log) disimpan sebagai **tanggal lokal keluarga**, bukan UTC. Kalau tidak, log jam 6 pagi WIB bisa tercatat di hari sebelumnya dan streak jadi salah. Zona waktu disimpan per keluarga (default `Asia/Jakarta`).

D1 menyalakan foreign key secara default.

### 5.3 Relasi antar tabel

```
better-auth (di-generate, jangan ditulis manual)
  user ─┬─< session
        ├─< account          (google / password)
        └─< member >── organization ──< invitation
                            │
                            │  organization = keluarga
                            │
                            ├─< categories
                            └─< children ──< subjects >── categories
                                               │
                                               ├─< units ──┐ (parent_id: hierarki)
                                               │     └─────┘
                                               └─< logs ──< log_items >── units
                                                     └──< attachments  (file di R2)

presets ──< preset_units        (data sistem: Juz 30, Iqra 1-6, dll)

Keterangan:  A ──< B  = satu A punya banyak B
```

### 5.4 Auth (better-auth)

Tabel auth dibuat oleh CLI better-auth (`npx @better-auth/cli generate`), tidak ditulis manual.

```
+--------------+----------------------------------------------------------+
| Tabel        | Isi                                                      |
+--------------+----------------------------------------------------------+
| user         | id, name, email, emailVerified, image                    |
| session      | sesi login                                               |
| account      | provider login: 'google' atau 'credential' (user/pass)   |
| verification | token verifikasi email & reset password                  |
| organization | KELUARGA. additionalFields: timezone                     |
| member       | user <-> keluarga, role: owner / admin / member          |
| invitation   | undangan pasangan via email                              |
+--------------+----------------------------------------------------------+
```

Plugin yang dipakai: `organization` (keluarga + undangan). Login: Google OAuth + email/password.

Aturan akses: semua tabel domain punya jalur ke `organization.id` (langsung atau lewat `children`). Setiap query di server **wajib** memfilter berdasarkan keluarga aktif di session.

### 5.5 Anak dan kategori

```sql
CREATE TABLE children (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL REFERENCES organization(id),
  name         TEXT NOT NULL,
  birth_date   TEXT,                -- 'YYYY-MM-DD'
  avatar       TEXT,
  archived_at  INTEGER,
  created_at   INTEGER NOT NULL
);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES organization(id),
  name        TEXT NOT NULL,       -- Quran, Sekolah, Kebiasaan
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
```

### 5.6 Preset (data sistem)

Template materi yang disalin ke `units` saat pelajaran dibuat dari preset. Datanya ditulis di `src/db/presets/*.ts` dan dimasukkan lewat seeder terpisah (`pnpm db:seed:presets`), bukan migrasi. Seeder melakukan upsert dengan id deterministik (`preset_<code>`, `pu_<code>_<key>`), jadi aman dijalankan ulang.

```sql
CREATE TABLE presets (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,   -- 'quran_juz30', 'iqra_1_6', 'kurmer_mtk_kelas2'
  name        TEXT NOT NULL,
  structure   TEXT NOT NULL CHECK (structure IN ('range', 'checklist', 'none')),
  unit_label  TEXT                    -- 'ayat', 'halaman'
);

CREATE TABLE preset_units (
  id          TEXT PRIMARY KEY,
  preset_id   TEXT NOT NULL REFERENCES presets(id),
  parent_id   TEXT REFERENCES preset_units(id),
  label       TEXT NOT NULL,          -- 'An-Naba', 'Iqra 2', 'Perkalian'
  size        INTEGER,                -- 40 ayat, 32 halaman (range saja)
  sort_order  INTEGER NOT NULL
);
```

### 5.7 Pelajaran dan materi

```sql
CREATE TABLE subjects (
  id              TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL REFERENCES children(id),
  category_id     TEXT REFERENCES categories(id),
  preset_id       TEXT REFERENCES presets(id),
  name            TEXT NOT NULL,
  structure       TEXT NOT NULL                    -- terkunci setelah ada log
                  CHECK (structure IN ('range', 'checklist', 'none')),
  unit_label      TEXT,                            -- range: 'ayat', 'halaman'
  open_ended      INTEGER NOT NULL DEFAULT 0,
  current_cycle   INTEGER NOT NULL DEFAULT 1,      -- range: khatam ke-berapa
  suggest_order   TEXT NOT NULL DEFAULT 'asc'      -- saran materi baru berikutnya
                  CHECK (suggest_order IN ('asc', 'desc', 'manual')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  archived_at     INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE TABLE units (
  id            TEXT PRIMARY KEY,
  subject_id    TEXT NOT NULL REFERENCES subjects(id),
  parent_id     TEXT REFERENCES units(id),       -- hierarki (checklist)
  label         TEXT NOT NULL,
  size          INTEGER,                         -- range: wajib; lainnya: NULL
  mastery       TEXT                             -- level terakhir (cache dari log)
                CHECK (mastery IN ('belum', 'kenal', 'bisa', 'mahir')),
  meaning       TEXT,                            -- vocab: 'sendok'
  tags          TEXT NOT NULL DEFAULT '[]',      -- JSON: ["house"]
  completed_at  INTEGER,                         -- penanda selesai manual
  sort_order    INTEGER NOT NULL DEFAULT 0,
  archived_at   INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE INDEX units_subject ON units (subject_id, sort_order);
```

`suggest_order` menentukan materi baru yang disarankan di layar "Hari Ini" setelah materi yang sedang berjalan selesai:

```
asc    -> materi belum dimulai dengan sort_order terkecil   (An-Naba -> An-Nas)
desc   -> materi belum dimulai dengan sort_order terbesar   (An-Nas -> An-Naba, umum di TPQ)
manual -> tidak ada saran materi baru; orang tua pilih sendiri
```

Urutan custom cukup dengan mengubah `sort_order` (drag & drop di UI).

### 5.8 Log

Satu log = satu sesi belajar. Satu log bisa menyentuh beberapa materi (misal murajaah 2 surah), jadi detail per materi ada di `log_items`.

```sql
CREATE TABLE logs (
  id             TEXT PRIMARY KEY,
  child_id       TEXT NOT NULL REFERENCES children(id),  -- denormalisasi untuk query cepat
  subject_id     TEXT NOT NULL REFERENCES subjects(id),
  logged_by      TEXT NOT NULL REFERENCES user(id),
  date           TEXT NOT NULL,        -- 'YYYY-MM-DD', tanggal lokal keluarga
  duration_min   INTEGER,
  mood           TEXT,                 -- emoji
  note           TEXT,
  created_at     INTEGER NOT NULL
);

CREATE TABLE log_items (
  id             TEXT PRIMARY KEY,
  log_id         TEXT NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  unit_id        TEXT NOT NULL REFERENCES units(id),
  -- range (keduanya NULL = seluruh materi, 1..units.size)
  range_from     INTEGER,
  range_to       INTEGER,
  cycle          INTEGER,              -- salinan subjects.current_cycle saat log dibuat
  -- checklist & range
  mastery_after  TEXT CHECK (mastery_after IN ('belum', 'kenal', 'bisa', 'mahir')),
  CHECK ((range_from IS NULL) = (range_to IS NULL)),
  CHECK (range_from IS NULL OR range_from <= range_to)
);

CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  log_id        TEXT NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,         -- 'fam_<id>/logs/<log_id>/<uuid>.webp'
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE INDEX logs_child_date   ON logs (child_id, date);
CREATE INDEX logs_subject_date ON logs (subject_id, date);
CREATE INDEX log_items_unit    ON log_items (unit_id);
```

Kolom `log_items` yang dipakai per bentuk materi:

```
+-----------+-------------------------------+----------------------------------+
| structure | log_items                     | Contoh                           |
+-----------+-------------------------------+----------------------------------+
| range     | unit_id, range_from?,         | An-Naba, 11, 20, cycle 1         |
|           | range_to?, cycle,             | Al-Ikhlas, NULL, NULL (= 1..4),  |
|           | mastery_after?                |   mahir                          |
| checklist | unit_id, mastery_after        | Perkalian, kenal                 |
| none      | (tidak ada baris)             | cukup baris di logs              |
+-----------+-------------------------------+----------------------------------+
```

File foto disimpan di bucket R2 **privat**. Upload lewat server function (atau presigned URL); file dibaca lewat route yang mengecek session dan keluarga, bukan URL publik.

### 5.9 Data yang dihitung (tidak disimpan)

```
+---------------------------+------------------------------------------------+
| Tampilan                  | Cara hitung                                    |
+---------------------------+------------------------------------------------+
| Progres range per materi  | gabungkan semua interval range_from..range_to  |
|                           | (NULL = 1..size) per unit + cycle, hitung      |
|                           | jumlah ayat/halaman UNIK, bagi units.size      |
| Range "selesai"           | ayat unik = size, atau completed_at terisi     |
| Saran lanjut              | ayat/halaman pertama yang belum tersentuh di   |
|                           | materi yang sedang berjalan; kalau tidak ada,  |
|                           | materi baru sesuai suggest_order               |
| Level checklist           | units.mastery (diperbarui setiap log baru)     |
| Streak                    | tanggal berturut-turut di logs per subject     |
| Total menit               | SUM(logs.duration_min) per periode             |
| Perlu diulang             | level materi (units.mastery) belum/kenal, atau |
|                           | range yang ≥14 hari tidak disentuh             |
| Perkiraan selesai (range) | ayat/halaman unik yang bertambah 28 hari       |
|                           | terakhir → sisa ÷ kecepatan                    |
+---------------------------+------------------------------------------------+
```

Kenapa ayat unik, bukan ayat terbesar:

```
Log: ayat 1-5, lalu ayat 11-15  (An-Nazi'at, 46 ayat)

MAX(range_to)  -> 15/46 = 33%   ✗ (ayat 6-10 belum)
ayat unik      -> 10/46 = 22%   ✓
```

Penggabungan interval dihitung di kode aplikasi (datanya kecil per anak), bukan di SQL.

`units.mastery` adalah satu-satunya cache: diisi dari `log_items.mastery_after` terakhir supaya layar daftar materi tidak perlu menghitung ulang.

### 5.10 Contoh: satu log di database

Log "21 Nov, Matematika, Perkalian, level kenal, 10 menit":

```
logs
+--------+--------+---------+------------+-----+
| id     | child  | subject | date       | min |
+--------+--------+---------+------------+-----+
| log_4  | Aisyah | MTK     | 2026-11-21 | 10  |
+--------+--------+---------+------------+-----+

log_items
+--------+-----------+---------------+
| log_id | unit      | mastery_after |
+--------+-----------+---------------+
| log_4  | Perkalian | kenal         |
+--------+-----------+---------------+

units (cache diperbarui)
+-----------+---------+
| label     | mastery |
+-----------+---------+
| Perkalian | kenal   |
+-----------+---------+
```

Contoh hafalan lompat-lompat (Juz 30, `suggest_order = desc`):

```
log_items
+------------+------------+----------+---------------+
| unit       | range_from | range_to | mastery_after |
+------------+------------+----------+---------------+
| An-Nas     | NULL       | NULL     | mahir         |  <- seluruh surah
| Al-Falaq   | NULL       | NULL     | mahir         |
| Al-Ikhlas  | NULL       | NULL     | bisa          |
| Al-Ma'un   | 1          | 4        | kenal         |  <- sebagian
+------------+------------+----------+---------------+

Progres "Hafalan Juz 30": 3/37 surah
Saran besok: Al-Ma'un ayat 5-7
```

## 6. Sample data

```
ANAK
+--------+------------+-----------------+
| Nama   | Lahir      | Umur (tampilan) |
+--------+------------+-----------------+
| Aisyah | 2018-03-14 | 8 tahun 8 bulan |
+--------+------------+-----------------+

PELAJARAN
+---------------+-----------+------------+
| Pelajaran     | structure | unit_label |
+---------------+-----------+------------+
| Hafalan Quran | range     | ayat       |
| Matematika    | checklist | -          |
| Baca buku     | none      | -          |
+---------------+-----------+------------+

MATERI
+---------------+-------------+---------+----------------------+
| Pelajaran     | Materi      | Ukuran  | Status               |
+---------------+-------------+---------+----------------------+
| Hafalan Quran | An-Naba     | 40 ayat | hafal                |
| Hafalan Quran | An-Nazi'at  | 46 ayat | sedang (s/d ayat 20) |
| Matematika    | Penjumlahan | -       | mahir                |
| Matematika    | Perkalian   | -       | kenal                |
+---------------+-------------+---------+----------------------+

LOG HARIAN  <-- satu-satunya yang diisi tiap hari
+--------+---------------+------------+------------------+-------+-------+
| Tgl    | Pelajaran     | Materi     | Detail           | Level | Menit |
+--------+---------------+------------+------------------+-------+-------+
| 20 Nov | Hafalan Quran | An-Nazi'at | ayat 11-20       | -     |  15   |
| 20 Nov | Baca buku     | -          | -                | -     |  15   |
| 21 Nov | Hafalan Quran | An-Naba    | seluruh surah    | kenal |  10   |
| 21 Nov | Matematika    | Perkalian  | -                | kenal |  10   |
| 21 Nov | Baca buku     | -          | -                | -     |  15   |
+--------+---------------+------------+------------------+-------+-------+

HASIL (dihitung otomatis, tidak diisi)
+--------------------------+---------------------------+-------------+
| Tampilan                 | Nilai                     | Dari        |
+--------------------------+---------------------------+-------------+
| Progres hafalan          | 1/2 surah (Nazi'at 20/46) | Materi+Log  |
| Perlu diulang            | An-Naba (level: kenal)    | Log 21 Nov  |
| Streak baca buku         | 2 hari                    | Log 20-21   |
| Total belajar minggu ini | 65 menit                  | kolom Menit |
+--------------------------+---------------------------+-------------+
```

## 7. Alur penggunaan

### 7.1 Frekuensi

```
+------------------+----------------------------------------------+-------------+
| Kapan            | Kegiatan                                     | Lama        |
+------------------+----------------------------------------------+-------------+
| Sekali di awal   | tambah anak (nama, avatar, tgl lahir),       | 10-15 menit |
|                  | pilih pelajaran (preset)                     |             |
| Setiap hari      | centang / isi log di layar "Hari Ini"        | 1-3 menit   |
| Kadang-kadang    | tambah kosakata / materi baru                | saat ada    |
| Mingguan/bulanan | lihat statistik & perkiraan selesai          | 5 menit     |
+------------------+----------------------------------------------+-------------+
```

### 7.2 Layar "Hari Ini"

Pintu masuk harian. Orang tua tidak mulai dari form kosong.

```
┌─ Hari Ini · Selasa, 24 Nov ───────────────┐
│  🦋 Aisyah                         1/1 ✓  │
│  ☑ Baca buku            Kebiasaan harian  │
│  ✨ SARAN                                  │
│  Lanjut 'Abasa ayat 17–42       [Catat]   │
│  Perlu diulang: An-Naba, At-Takwir [Ulang]│
│                                           │
│  🦁 Umar                                  │
│  ✨ Lanjut Iqra 2 halaman 16–32  [Catat]   │
└───────────────────────────────────────────┘
```

Daftar diisi dari:

1. Kebiasaan harian (pelajaran `none`): centang sekali tap.
2. Saran lanjut: ayat/halaman berikutnya dari materi yang sedang berjalan, atau materi baru sesuai urutan.
3. Perlu diulang: materi dengan level belum/kenal, atau hafalan yang ≥14 hari tidak disentuh.

### 7.3 Mencatat log

Tap item → form kecil yang sudah terisi sebagian → simpan. Default: materi & ayat dari saran, level = level materi saat ini (belum pernah → Kenal), durasi & mood = catatan terakhir pelajaran itu (belum ada → 15 menit, 🙂). Untuk kebiasaan (`none`), cukup centang tanpa form.

```
┌─ Catat 'Abasa ────────────────────────────┐
│  Ayat     : 17 – [20]                     │
│  Level    : (belum) (kenal) (bisa) (mahir)│
│  Durasi   : [10] menit                    │
│  Catatan  : (opsional)                    │
│                [Lewati]   [Simpan ✓]      │
└───────────────────────────────────────────┘
```

## 8. Aturan bisnis

1. Pelajaran dibuat **per anak**. Anak lain memakai preset yang sama untuk membuat pelajarannya sendiri.
2. `structure` **tidak bisa diubah** setelah pelajaran punya log. Kalau salah pilih, buat pelajaran baru.
3. Progres & perkiraan selesai **dihitung dari log**, tidak diisi manual.
4. Centang kebiasaan di Hari Ini menghasilkan log.
5. Tidak ada jenis kegiatan: ziyadah dan murajaah sama-sama dicatat sebagai log biasa pada materinya. Hafalan dan tilawah adalah 2 pelajaran berbeda yang dikelompokkan dalam kategori yang sama.
6. Perbandingan antar anak disembunyikan secara default.
7. Untuk `range`, detail ayat/halaman di log **opsional**. Kosong berarti seluruh materi. Surah pendek cukup dicatat per surah; surah panjang bisa dicatat per ayat.
8. Materi `range` boleh dikerjakan **tidak berurutan**. Progres dihitung per materi dari ayat/halaman unik, dan ringkasan menghitung jumlah materi yang selesai.
9. Semua data hanya bisa diakses oleh anggota keluarga yang sama.
10. **Reset progres** per pelajaran menghapus permanen semua catatan & fotonya serta mengosongkan level/tanda selesai materi (daftar materi tetap). Wajib mengetik `confirm`; server menolak teks lain.

## 9. Ruang lingkup

### MVP

1. Auth (Google + email/password) + keluarga + multi profil anak
2. Pelajaran dengan 3 bentuk materi + preset (Juz 30, Iqra 1–6)
3. Layar Hari Ini + quick log
4. Statistik dasar: heatmap, streak, peta hafalan

### Fase 2

- Undang pasangan ke keluarga
- Penjadwal murajaah (spaced repetition)
- Reward / poin bintang
- Milestone & achievement
- Laporan mingguan/bulanan (share/PDF)
- Template kurikulum (Kurikulum Merdeka per kelas)
- Mode kuis/flashcard untuk vocab
- Catatan kesalahan ayat
- Mode offline

## 10. Tech stack

### 10.1 Sudah diputuskan

```
+---------------+------------------------------------------------------+
| Bagian        | Pilihan                                              |
+---------------+------------------------------------------------------+
| Framework     | TanStack Start (React, SSR, server functions)        |
| Infra         | Cloudflare Workers                                   |
| Database      | Cloudflare D1 (SQLite)                               |
| File storage  | Cloudflare R2 (bucket privat)                        |
| Auth          | better-auth: Google OAuth + email/password,          |
|               | plugin organization (keluarga)                       |
| UI            | shadcn/ui + Tailwind, responsive mobile & desktop    |
+---------------+------------------------------------------------------+
```

### 10.2 Usulan pelengkap

```
+------------------+-------------------------------+----------------------------------+
| Bagian           | Usulan                        | Alasan                           |
+------------------+-------------------------------+----------------------------------+
| ORM & migrasi    | Drizzle ORM + drizzle-kit     | dukung D1, ada adapter           |
|                  |                               | better-auth                      |
| Data fetching    | TanStack Query                | cache & invalidasi setelah log   |
| Form & validasi  | react-hook-form + Zod (shadcn | Zod dipakai juga di server fn    |
|                  | form)                         |                                  |
| Grafik           | shadcn charts (Recharts)      | heatmap, tren, progres           |
| Tanggal          | date-fns + date-fns-tz        | tanggal lokal keluarga, streak   |
| Email            | Resend (atau sejenis)         | verifikasi, reset password,      |
|                  |                               | undangan keluarga                |
| Gambar           | kompres di browser sebelum    | foto HP besar; hemat R2 & kuota  |
|                  | upload (WebP, maks ~1600px)   |                                  |
| Installable      | PWA (manifest + service       | bisa "Add to Home Screen" di HP  |
|                  | worker dasar)                 |                                  |
| Testing          | Vitest (logika progres,       | hitung interval/streak rawan bug |
|                  | streak, perkiraan selesai)    |                                  |
| Error tracking   | Sentry (opsional)             |                                  |
| Deploy           | Wrangler + GitHub Actions     | migrasi D1 + deploy otomatis     |
| Lokal            | wrangler dev (D1 & R2 lokal)  |                                  |
+------------------+-------------------------------+----------------------------------+
```

### 10.3 Catatan teknis

- **Isolasi data keluarga**: setiap server function mengambil keluarga aktif dari session better-auth dan memfilter semua query dengannya. Buat satu helper yang wajib dipakai, jangan ditulis ulang di setiap query.
- **Zona waktu**: tanggal log ditentukan dari zona waktu keluarga, bukan zona server (Workers berjalan di UTC).
- **Seed preset**: data Juz 30 (37 surah + jumlah ayat) dan Iqra 1–6 (jumlah halaman) ditulis di `src/db/presets/` dan dimasukkan lewat `pnpm db:seed:presets` (lokal) / `pnpm db:seed:presets:remote` (production, dijalankan di pipeline setelah migrasi).
- **Backup**: D1 Time Travel (restore titik waktu) + fitur export data (CSV/JSON) untuk orang tua.
- **Data anak**: foto dan catatan bersifat privat. Bucket R2 tidak publik, file disajikan lewat route yang mengecek akses.

## 11. Pertanyaan terbuka

1. Kapan surah dianggap "hafal": otomatis (semua ayat tersentuh + murajaah lancar) atau ditandai manual? (default sementara: keduanya, lihat 5.1)
2. Skala level satu global, atau boleh custom per pelajaran?
3. Perlu bisa dipakai offline sejak MVP?
4. Rentang usia anak: TK–SD saja, atau sampai SMP?
5. Layanan email untuk verifikasi, reset password, dan undangan?
6. Satu user boleh ikut lebih dari satu keluarga (misal kakek/nenek)?
