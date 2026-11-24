/**
 * Skema domain. Lihat docs.md bagian 5 untuk penjelasan setiap tabel.
 *
 * Konvensi SQLite/D1:
 * - id: TEXT (UUID)
 * - enum: TEXT + CHECK
 * - array: TEXT berisi JSON
 * - waktu kejadian: INTEGER unix ms (UTC)
 * - tanggal kalender: TEXT 'YYYY-MM-DD' di zona waktu keluarga
 */
import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import { organization, user } from './auth-schema'
import {
  MASTERY_LEVELS,
  STRUCTURES,
  SUGGEST_ORDERS,
} from './enums'

export * from './auth-schema'
export * from './enums'

const inList = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(', '))

// ---------------------------------------------------------------------------
// Helper kolom
// ---------------------------------------------------------------------------

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())

const archivedAt = () => integer('archived_at', { mode: 'timestamp_ms' })

/** Tanggal kalender lokal keluarga, format 'YYYY-MM-DD'. */
const localDate = (name: string) => text(name)

const jsonArray = (name: string) =>
  text(name, { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`)

// ---------------------------------------------------------------------------
// Anak & kategori
// ---------------------------------------------------------------------------

export const children = sqliteTable(
  'children',
  {
    id: id(),
    familyId: text('family_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    birthDate: localDate('birth_date'),
    avatar: text('avatar'),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
  },
  (t) => [index('children_family_idx').on(t.familyId)],
)

export const categories = sqliteTable(
  'categories',
  {
    id: id(),
    familyId: text('family_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('categories_family_idx').on(t.familyId)],
)

// ---------------------------------------------------------------------------
// Preset (data sistem)
// ---------------------------------------------------------------------------

export const presets = sqliteTable(
  'presets',
  {
    id: id(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    structure: text('structure', { enum: STRUCTURES }).notNull(),
    unitLabel: text('unit_label'),
  },
  (t) => [
    check('presets_structure_chk', sql`${t.structure} IN (${inList(STRUCTURES)})`),
  ],
)

export const presetUnits = sqliteTable(
  'preset_units',
  {
    id: id(),
    presetId: text('preset_id')
      .notNull()
      .references(() => presets.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references(
      (): AnySQLiteColumn => presetUnits.id,
    ),
    label: text('label').notNull(),
    size: integer('size'),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [index('preset_units_preset_idx').on(t.presetId, t.sortOrder)],
)

// ---------------------------------------------------------------------------
// Pelajaran & materi
// ---------------------------------------------------------------------------

export const subjects = sqliteTable(
  'subjects',
  {
    id: id(),
    childId: text('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    presetId: text('preset_id').references(() => presets.id),
    name: text('name').notNull(),
    /** Terkunci setelah pelajaran punya log. */
    structure: text('structure', { enum: STRUCTURES }).notNull(),
    unitLabel: text('unit_label'),
    openEnded: integer('open_ended', { mode: 'boolean' })
      .notNull()
      .default(false),
    currentCycle: integer('current_cycle').notNull().default(1),
    suggestOrder: text('suggest_order', { enum: SUGGEST_ORDERS })
      .notNull()
      .default('asc'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
  },
  (t) => [
    index('subjects_child_idx').on(t.childId),
    check('subjects_structure_chk', sql`${t.structure} IN (${inList(STRUCTURES)})`),
    check(
      'subjects_suggest_order_chk',
      sql`${t.suggestOrder} IN (${inList(SUGGEST_ORDERS)})`,
    ),
  ],
)

export const units = sqliteTable(
  'units',
  {
    id: id(),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnySQLiteColumn => units.id, {
      onDelete: 'cascade',
    }),
    label: text('label').notNull(),
    /** Wajib untuk range (jumlah ayat/halaman), NULL untuk lainnya. */
    size: integer('size'),
    /** Cache level terakhir dari log_items.mastery_after. */
    mastery: text('mastery', { enum: MASTERY_LEVELS }),
    meaning: text('meaning'),
    tags: jsonArray('tags'),
    /** Penanda selesai manual. */
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
  },
  (t) => [
    index('units_subject_idx').on(t.subjectId, t.sortOrder),
    check(
      'units_mastery_chk',
      sql`${t.mastery} IS NULL OR ${t.mastery} IN (${inList(MASTERY_LEVELS)})`,
    ),
    check('units_size_chk', sql`${t.size} IS NULL OR ${t.size} > 0`),
  ],
)

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

export const logs = sqliteTable(
  'logs',
  {
    id: id(),
    /** Denormalisasi dari subjects.child_id untuk query cepat. */
    childId: text('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    loggedBy: text('logged_by')
      .notNull()
      .references(() => user.id),
    date: localDate('date').notNull(),
    durationMin: integer('duration_min'),
    mood: text('mood'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('logs_child_date_idx').on(t.childId, t.date),
    index('logs_subject_date_idx').on(t.subjectId, t.date),
  ],
)

export const logItems = sqliteTable(
  'log_items',
  {
    id: id(),
    logId: text('log_id')
      .notNull()
      .references(() => logs.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    /** range: keduanya NULL = seluruh materi (1..units.size). */
    rangeFrom: integer('range_from'),
    rangeTo: integer('range_to'),
    /** Salinan subjects.current_cycle saat log dibuat. */
    cycle: integer('cycle'),
    masteryAfter: text('mastery_after', { enum: MASTERY_LEVELS }),
  },
  (t) => [
    index('log_items_unit_idx').on(t.unitId),
    index('log_items_log_idx').on(t.logId),
    check(
      'log_items_range_pair_chk',
      sql`(${t.rangeFrom} IS NULL) = (${t.rangeTo} IS NULL)`,
    ),
    check(
      'log_items_range_order_chk',
      sql`${t.rangeFrom} IS NULL OR (${t.rangeFrom} >= 1 AND ${t.rangeFrom} <= ${t.rangeTo})`,
    ),
    check(
      'log_items_mastery_chk',
      sql`${t.masteryAfter} IS NULL OR ${t.masteryAfter} IN (${inList(MASTERY_LEVELS)})`,
    ),
  ],
)

export const attachments = sqliteTable(
  'attachments',
  {
    id: id(),
    logId: text('log_id')
      .notNull()
      .references(() => logs.id, { onDelete: 'cascade' }),
    /** 'fam_<id>/logs/<log_id>/<uuid>.webp' di bucket R2 privat. */
    r2Key: text('r2_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('attachments_log_idx').on(t.logId)],
)
