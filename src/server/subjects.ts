/**
 * Server function pelajaran (subjects). Lihat docs.md bagian 3 & 5.7.
 */
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/db'
import { chunkRows } from '@/db/batch'
import {
  MASTERY_LEVELS,
  type MasteryLevel,
  STRUCTURES,
  SUGGEST_ORDERS,
} from '@/db/enums'
import { todayIn } from '@/lib/dates'
import type { RangePace } from '@/lib/progress/pace'
import {
  PRESET_DEFAULTS,
} from '@/lib/subject-meta'
import {
  assertCategoryInFamily,
  getChildForFamily,
  getSubjectForFamily,
  subjectHasLogs,
} from './access.server'
import { familyMiddleware } from './family'
import { runBatch } from './logs.server'
import { loadActiveUnits, loadRangeState } from './progress.server'
import { deleteObjects } from './storage.server'

// ---------------------------------------------------------------------------
// Opsi form
// ---------------------------------------------------------------------------

export const getSubjectFormOptions = createServerFn({ method: 'GET' })
  .middleware([familyMiddleware])
  .handler(async ({ context }) => {
    const db = getDb()
    const [presets, categories] = await Promise.all([
      db
        .select({
          id: schema.presets.id,
          code: schema.presets.code,
          name: schema.presets.name,
          structure: schema.presets.structure,
          unitLabel: schema.presets.unitLabel,
          unitCount: count(schema.presetUnits.id),
        })
        .from(schema.presets)
        .leftJoin(
          schema.presetUnits,
          eq(schema.presetUnits.presetId, schema.presets.id),
        )
        .groupBy(schema.presets.id)
        .orderBy(asc(schema.presets.name)),
      db
        .select({
          id: schema.categories.id,
          name: schema.categories.name,
          color: schema.categories.color,
        })
        .from(schema.categories)
        .where(eq(schema.categories.familyId, context.familyId))
        .orderBy(asc(schema.categories.sortOrder)),
    ])
    return { presets, categories }
  })

// ---------------------------------------------------------------------------
// Ringkasan progres
// ---------------------------------------------------------------------------

export type SubjectSummary =
  | {
      kind: 'range'
      done: number
      total: number
      covered: number
      size: number
      pace: RangePace | null
    }
  | {
      kind: 'checklist'
      total: number
      byLevel: Record<MasteryLevel, number>
    }
  | { kind: 'none' }

// ---------------------------------------------------------------------------
// Detail anak + daftar pelajaran
// ---------------------------------------------------------------------------

export const getChildDetail = createServerFn({ method: 'GET' })
  .middleware([familyMiddleware])
  .validator(z.object({ childId: z.string() }))
  .handler(async ({ data, context }) => {
    const child = await getChildForFamily(data.childId, context.familyId)
    const db = getDb()

    const subjects = await db
      .select({
        id: schema.subjects.id,
        name: schema.subjects.name,
        structure: schema.subjects.structure,
        unitLabel: schema.subjects.unitLabel,
        currentCycle: schema.subjects.currentCycle,
        categoryId: schema.subjects.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
      })
      .from(schema.subjects)
      .leftJoin(
        schema.categories,
        eq(schema.subjects.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.subjects.childId, child.id),
          isNull(schema.subjects.archivedAt),
        ),
      )
      .orderBy(asc(schema.subjects.sortOrder), asc(schema.subjects.createdAt))

    const units = await loadActiveUnits(subjects.map((s) => s.id))
    const rangeSubjects = subjects.filter((s) => s.structure === 'range')
    const { progress, pace } = await loadRangeState(
      rangeSubjects,
      units.filter((u) => rangeSubjects.some((s) => s.id === u.subjectId)),
      todayIn(context.timezone),
    )

    const withSummary = subjects.map((s) => {
      const own = units.filter((u) => u.subjectId === s.id)
      let summary: SubjectSummary
      if (s.structure === 'range') {
        const ps = own.map((u) => progress.get(u.id)).filter((p) => p !== undefined)
        summary = {
          kind: 'range',
          total: own.length,
          done: ps.filter((p) => p.done).length,
          covered: ps.reduce((n, p) => n + p.covered, 0),
          size: ps.reduce((n, p) => n + p.size, 0),
          pace: pace.get(s.id) ?? null,
        }
      } else if (s.structure === 'checklist') {
        // Hanya topik paling bawah (tanpa anak) yang dihitung.
        const parentIds = new Set(own.map((u) => u.parentId).filter(Boolean))
        const leaves = own.filter((u) => !parentIds.has(u.id))
        const byLevel = Object.fromEntries(
          MASTERY_LEVELS.map((l) => [l, 0]),
        ) as Record<MasteryLevel, number>
        for (const u of leaves) byLevel[u.mastery ?? 'belum']++
        summary = { kind: 'checklist', total: leaves.length, byLevel }
      } else {
        summary = { kind: 'none' }
      }
      return { ...s, summary }
    })

    return {
      child: {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        birthDate: child.birthDate,
      },
      subjects: withSummary,
    }
  })

// ---------------------------------------------------------------------------
// Buat pelajaran
// ---------------------------------------------------------------------------

const createSubjectInput = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('preset'),
    childId: z.string(),
    presetId: z.string(),
    name: z.string().trim().min(1).max(60).optional(),
    categoryId: z.string().nullish(),
  }),
  z.object({
    source: z.literal('custom'),
    childId: z.string(),
    name: z.string().trim().min(1).max(60),
    structure: z.enum(STRUCTURES),
    unitLabel: z.string().trim().max(20).nullish(),
    openEnded: z.boolean().default(false),
    suggestOrder: z.enum(SUGGEST_ORDERS).default('asc'),
    categoryId: z.string().nullish(),
  }),
])

export const createSubject = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(createSubjectInput)
  .handler(async ({ data, context }) => {
    const child = await getChildForFamily(data.childId, context.familyId)
    await assertCategoryInFamily(data.categoryId, context.familyId)
    const db = getDb()

    const [{ maxOrder }] = await db
      .select({ maxOrder: count() })
      .from(schema.subjects)
      .where(eq(schema.subjects.childId, child.id))

    if (data.source === 'custom') {
      const [subject] = await db
        .insert(schema.subjects)
        .values({
          childId: child.id,
          categoryId: data.categoryId ?? null,
          name: data.name,
          structure: data.structure,
          unitLabel: data.structure === 'range' ? (data.unitLabel ?? null) : null,
          openEnded: data.structure === 'none' ? false : data.openEnded,
          suggestOrder: data.suggestOrder,
          sortOrder: maxOrder,
        })
        .returning({ id: schema.subjects.id })
      return subject
    }

    // Dari preset: salin preset_units ke units milik pelajaran baru.
    const [preset] = await db
      .select()
      .from(schema.presets)
      .where(eq(schema.presets.id, data.presetId))
      .limit(1)
    if (!preset) throw notFound()

    const presetUnits = await db
      .select()
      .from(schema.presetUnits)
      .where(eq(schema.presetUnits.presetId, preset.id))
      .orderBy(asc(schema.presetUnits.sortOrder))

    const defaults = PRESET_DEFAULTS[preset.code]
    let categoryId = data.categoryId ?? null
    if (!categoryId && defaults?.categoryName) {
      const [cat] = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.familyId, context.familyId),
            eq(schema.categories.name, defaults.categoryName),
          ),
        )
        .limit(1)
      categoryId = cat?.id ?? null
    }

    const subjectId = crypto.randomUUID()
    const unitIdByPreset = new Map(
      presetUnits.map((pu) => [pu.id, crypto.randomUUID()]),
    )
    const now = new Date()
    const unitRows = presetUnits.map((pu) => ({
      id: unitIdByPreset.get(pu.id)!,
      subjectId,
      parentId: pu.parentId ? (unitIdByPreset.get(pu.parentId) ?? null) : null,
      label: pu.label,
      size: pu.size,
      sortOrder: pu.sortOrder,
      createdAt: now,
    }))

    const subjectInsert = db.insert(schema.subjects).values({
      id: subjectId,
      childId: child.id,
      categoryId,
      presetId: preset.id,
      name: data.name ?? preset.name,
      structure: preset.structure,
      unitLabel: preset.unitLabel,
      suggestOrder: defaults?.suggestOrder ?? 'asc',
      sortOrder: maxOrder,
      createdAt: now,
    })
    // Parent harus masuk lebih dulu dari anaknya (FK self-reference).
    const parentsFirst = [
      ...unitRows.filter((u) => u.parentId === null),
      ...unitRows.filter((u) => u.parentId !== null),
    ]
    await db.batch([
      subjectInsert,
      ...chunkRows(parentsFirst).map((rows) =>
        db.insert(schema.units).values(rows),
      ),
    ])
    return { id: subjectId }
  })

// ---------------------------------------------------------------------------
// Detail pelajaran
// ---------------------------------------------------------------------------

export const getSubjectDetail = createServerFn({ method: 'GET' })
  .middleware([familyMiddleware])
  .validator(z.object({ subjectId: z.string() }))
  .handler(async ({ data, context }) => {
    const { subject, child } = await getSubjectForFamily(
      data.subjectId,
      context.familyId,
    )
    const units = await loadActiveUnits([subject.id])
    const range =
      subject.structure === 'range'
        ? await loadRangeState([subject], units, todayIn(context.timezone))
        : null
    const progress = range?.progress ?? new Map()
    const [{ logCount }] = await getDb()
      .select({ logCount: count() })
      .from(schema.logs)
      .where(eq(schema.logs.subjectId, subject.id))
    const hasLogs = logCount > 0
    // Isian default form catat: durasi & mood dari catatan terakhir.
    const [lastLog] = await getDb()
      .select({ durationMin: schema.logs.durationMin, mood: schema.logs.mood })
      .from(schema.logs)
      .where(eq(schema.logs.subjectId, subject.id))
      .orderBy(desc(schema.logs.date), desc(schema.logs.createdAt))
      .limit(1)

    return {
      child: { id: child.id, name: child.name, avatar: child.avatar },
      subject: {
        id: subject.id,
        name: subject.name,
        structure: subject.structure,
        unitLabel: subject.unitLabel,
        openEnded: subject.openEnded,
        suggestOrder: subject.suggestOrder,
        categoryId: subject.categoryId,
        currentCycle: subject.currentCycle,
        presetId: subject.presetId,
      },
      hasLogs,
      logCount,
      lastLog: lastLog ?? null,
      /** Kecepatan & perkiraan selesai (khusus range). */
      pace: range?.pace.get(subject.id) ?? null,
      units: units.map((u) => ({
        id: u.id,
        parentId: u.parentId,
        label: u.label,
        size: u.size,
        mastery: u.mastery,
        meaning: u.meaning,
        tags: u.tags,
        sortOrder: u.sortOrder,
        completedAt: u.completedAt,
        progress: progress.get(u.id) ?? null,
      })),
    }
  })

// ---------------------------------------------------------------------------
// Edit & arsip pelajaran
// ---------------------------------------------------------------------------

const updateSubjectInput = z.object({
  subjectId: z.string(),
  name: z.string().trim().min(1).max(60),
  structure: z.enum(STRUCTURES),
  unitLabel: z.string().trim().max(20).nullish(),
  openEnded: z.boolean(),
  suggestOrder: z.enum(SUGGEST_ORDERS),
  categoryId: z.string().nullish(),
})

export const updateSubject = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(updateSubjectInput)
  .handler(async ({ data, context }) => {
    const { subject } = await getSubjectForFamily(data.subjectId, context.familyId)
    await assertCategoryInFamily(data.categoryId, context.familyId)

    // docs.md aturan bisnis #2: structure terkunci setelah ada log.
    if (data.structure !== subject.structure && (await subjectHasLogs(subject.id))) {
      throw new Error('STRUCTURE_LOCKED')
    }

    await getDb()
      .update(schema.subjects)
      .set({
        name: data.name,
        structure: data.structure,
        unitLabel: data.structure === 'range' ? (data.unitLabel ?? null) : null,
        openEnded: data.structure === 'none' ? false : data.openEnded,
        suggestOrder: data.suggestOrder,
        categoryId: data.categoryId ?? null,
      })
      .where(eq(schema.subjects.id, subject.id))
    return { id: subject.id }
  })

/** Teks yang harus diketik untuk reset progres (dicek juga di server). */
export const RESET_CONFIRM_TEXT = 'confirm'

/**
 * Reset progres satu pelajaran: hapus semua catatan + foto, kosongkan level
 * dan tanda selesai materi, kembali ke putaran 1. Daftar materi tetap ada.
 */
export const resetSubjectProgress = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(z.object({ subjectId: z.string(), confirm: z.literal(RESET_CONFIRM_TEXT) }))
  .handler(async ({ data, context }) => {
    const { subject } = await getSubjectForFamily(data.subjectId, context.familyId)
    const db = getDb()

    const files = await db
      .select({ key: schema.attachments.r2Key })
      .from(schema.attachments)
      .innerJoin(schema.logs, eq(schema.attachments.logId, schema.logs.id))
      .where(eq(schema.logs.subjectId, subject.id))
    const [{ logs }] = await db
      .select({ logs: count() })
      .from(schema.logs)
      .where(eq(schema.logs.subjectId, subject.id))

    // log_items & attachments ikut terhapus lewat FK cascade.
    await runBatch([
      db.delete(schema.logs).where(eq(schema.logs.subjectId, subject.id)),
      db
        .update(schema.units)
        .set({ mastery: null, completedAt: null })
        .where(eq(schema.units.subjectId, subject.id)),
      db.update(schema.subjects).set({ currentCycle: 1 }).where(eq(schema.subjects.id, subject.id)),
    ])
    await deleteObjects(files.map((f) => f.key))
    return { deletedLogs: logs, deletedFiles: files.length }
  })

export const archiveSubject = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(z.object({ subjectId: z.string() }))
  .handler(async ({ data, context }) => {
    const { subject } = await getSubjectForFamily(data.subjectId, context.familyId)
    await getDb()
      .update(schema.subjects)
      .set({ archivedAt: new Date() })
      .where(eq(schema.subjects.id, subject.id))
    return { childId: subject.childId }
  })
