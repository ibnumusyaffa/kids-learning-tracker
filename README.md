# Kids Tracker

Aplikasi untuk orang tua mencatat dan memantau belajar anak: hafalan Quran, Iqra, pelajaran sekolah, dan kebiasaan harian. Rencana proses bisnis dan skema data ada di [docs.md](./docs.md).

Stack: TanStack Start · Cloudflare Workers · D1 (SQLite) · R2 · Drizzle · better-auth · shadcn/ui.

## Setup lokal

```bash
pnpm install
cp .dev.vars.example .dev.vars   # lalu isi BETTER_AUTH_SECRET (openssl rand -hex 32)
pnpm db:setup:local              # migrasi + seed preset di D1 lokal
pnpm db:seed:dev                 # opsional: data demo (demo@kids.test / password123)
pnpm dev                         # http://localhost:3000
```

Login Google opsional di lokal. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di `.dev.vars` untuk mengaktifkannya (redirect URI: `http://localhost:3000/api/auth/callback/google`).

## Script

| Script | Fungsi |
|---|---|
| `pnpm dev` | Dev server (D1 & R2 lokal lewat Wrangler) |
| `pnpm build` | Build production |
| `pnpm deploy` | Build lalu deploy ke Cloudflare |
| `pnpm test` | Unit test (Vitest) |
| `pnpm typecheck` | Cek tipe TypeScript |
| `pnpm db:generate` | Generate migrasi dari `src/db/schema.ts` |
| `pnpm db:migrate:local` | Apply migrasi ke D1 lokal |
| `pnpm db:migrate:remote` | Apply migrasi ke D1 production |
| `pnpm db:seed:presets` | Seed/update preset (template materi) ke D1 lokal; aman diulang |
| `pnpm db:seed:presets:remote` | Seed/update preset ke D1 production |
| `pnpm db:setup:local` | Migrasi + seed preset lokal |
| `pnpm db:seed:dev` | Data demo lokal (login `demo@kids.test` / `password123`); aman diulang |
| `pnpm cf-typegen` | Regenerate tipe binding setelah mengubah `wrangler.jsonc` |

## Struktur

```
src/
  db/
    auth-schema.ts     tabel better-auth (user, session, organization = keluarga, ...)
    schema.ts          tabel domain (children, subjects, units, logs, ...)
    index.ts           client Drizzle untuk D1 (server-only)
    presets/           data preset (Juz 30, dst) + generator SQL seeder
  lib/
    auth.ts            konfigurasi better-auth (server-only)
    auth-client.ts     client better-auth untuk browser
    dates.ts           tanggal lokal keluarga
    progress/          logika progres range & streak (+ test)
  server/
    family.ts          server function session & middleware keluarga
    family.server.ts   helper server-only
    children.ts        server function profil anak
  routes/              halaman (file-based routing)
drizzle/               file migrasi SQL (di-apply oleh Wrangler)
scripts/
  seed-presets.ts      seeder preset (jalan langsung dengan Node)
```

## Preset (template materi)

Preset adalah data sistem (misal daftar 37 surah Juz 30) yang disalin ke materi anak saat orang tua membuat pelajaran. Datanya ditulis di `src/db/presets/*.ts`, bukan di migrasi.

- Tambah preset: buat file baru di `src/db/presets/`, daftarkan di `index.ts`, jalankan `pnpm db:seed:presets`.
- Ubah preset: edit file-nya lalu seed ulang. Pelajaran yang sudah dibuat tidak berubah (mereka memakai salinan).
- Jangan ubah `code` preset atau `key` unit setelah rilis, karena keduanya membentuk id.

## Aturan penting

- **Isolasi keluarga**: setiap server function yang membaca/menulis data domain wajib memakai `familyMiddleware` dan memfilter dengan `context.familyId`.
- **Tanggal**: tanggal log disimpan sebagai `YYYY-MM-DD` di zona waktu keluarga. Pakai `todayIn(timezone)`, jangan `new Date()` di server (Workers berjalan di UTC).
- **Server-only**: modul yang mengakses DB/auth diberi `import '@tanstack/react-start/server-only'`, dan hanya dipanggil dari dalam handler server function.

## Production

Live: https://kids-tracker.ibnu-musyaffa.workers.dev (D1 `kids-tracker` & R2 `kids-tracker-uploads`, region APAC).

Deploy manual:

```bash
pnpm db:migrate:remote
pnpm db:seed:presets:remote
pnpm run deploy
```

Deploy otomatis lewat `.github/workflows/ci.yml` saat push ke `main` (butuh secrets repo `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`).

### Deploy pertama (akun baru)

```bash
npx wrangler d1 create kids-tracker          # salin database_id ke wrangler.jsonc
npx wrangler r2 bucket create kids-tracker-uploads
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL       # URL production
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
pnpm db:migrate:remote
pnpm db:seed:presets:remote
pnpm deploy
```
