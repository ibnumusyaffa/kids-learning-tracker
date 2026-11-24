/**
 * Server function materi (units). Lihat docs.md bagian 3 & 5.7.
 */
import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull, max } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/db'
import { MASTERY_LEVELS } from '@/db/enums'
import { getSubjectForFamily, getUnitForFamily } from './access.server'
import { familyMiddleware } from './family'
import { assertValidParent, normalizeFields } from './units.server'

const unitFields = z.object({
  label: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(100_000).nullish(),
  parentId: z.string().nullish(),
  meaning: z.string().trim().max(200).nullish(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
})

export const createUnit = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(unitFields.extend({ subjectId: z.string() }))
  .handler(async ({ data, context }) => {
    const { subject } = await getSubjectForFamily(data.subjectId, context.familyId)
    const fields = normalizeFields(subject, data)
    await assertValidParent(subject.id, fields.parentId)

    const db = getDb()
    const [{ maxOrder }] = await db
      .select({ maxOrder: max(schema.units.sortOrder) })
      .from(schema.units)
      .where(eq(schema.units.subjectId, subject.id))

    const [unit] = await db
      .insert(schema.units)
      .values({ ...fields, subjectId: subject.id, sortOrder: (maxOrder ?? 0) + 1 })
      .returning({ id: schema.units.id })
    return unit
  })

export const updateUnit = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(unitFields.extend({ unitId: z.string() }))
  .handler(async ({ data, context }) => {
    const { unit, subject } = await getUnitForFamily(data.unitId, context.familyId)
    const fields = normalizeFields(subject, data)
    await assertValidParent(subject.id, fields.parentId, unit.id)

    await getDb()
      .update(schema.units)
      .set(fields)
      .where(eq(schema.units.id, unit.id))
    return { id: unit.id }
  })

/** Ubah level langsung dari halaman materi (selain lewat log). */
export const setUnitMastery = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(
    z.object({ unitId: z.string(), mastery: z.enum(MASTERY_LEVELS).nullable() }),
  )
  .handler(async ({ data, context }) => {
    const { unit } = await getUnitForFamily(data.unitId, context.familyId)
    const [child] = await getDb()
      .select({ id: schema.units.id })
      .from(schema.units)
      .where(and(eq(schema.units.parentId, unit.id), isNull(schema.units.archivedAt)))
      .limit(1)
    if (child) throw new Error('PARENT_UNIT')
    await getDb()
      .update(schema.units)
      .set({ mastery: data.mastery })
      .where(eq(schema.units.id, unit.id))
    return { id: unit.id }
  })

/** Penanda selesai manual untuk materi range. */
export const setUnitCompleted = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(z.object({ unitId: z.string(), completed: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { unit } = await getUnitForFamily(data.unitId, context.familyId)
    await getDb()
      .update(schema.units)
      .set({ completedAt: data.completed ? new Date() : null })
      .where(eq(schema.units.id, unit.id))
    return { id: unit.id }
  })

/**
 * Simpan urutan baru satu kelompok saudara (topik utama, atau sub-topik dalam
 * satu induk) hasil drag & drop. `orderedIds` harus berisi persis semua
 * saudara yang aktif; kalau tidak (tampilan sudah basi), ditolak.
 */
export const reorderUnits = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(
    z.object({
      subjectId: z.string(),
      parentId: z.string().nullable(),
      orderedIds: z.array(z.string()).min(1).max(1000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { subject } = await getSubjectForFamily(data.subjectId, context.familyId)
    const db = getDb()
    const siblings = await db
      .select({ id: schema.units.id, sortOrder: schema.units.sortOrder })
      .from(schema.units)
      .where(
        and(
          eq(schema.units.subjectId, subject.id),
          data.parentId ? eq(schema.units.parentId, data.parentId) : isNull(schema.units.parentId),
          isNull(schema.units.archivedAt),
        ),
      )

    const current = new Set(siblings.map((s) => s.id))
    const wanted = new Set(data.orderedIds)
    if (
      wanted.size !== data.orderedIds.length ||
      wanted.size !== current.size ||
      ![...wanted].every((id) => current.has(id))
    ) {
      throw new Error('ORDER_MISMATCH')
    }

    const orderOf = new Map(siblings.map((s) => [s.id, s.sortOrder]))
    const updates = data.orderedIds
      .map((id, i) => ({ id, sortOrder: i + 1 }))
      .filter((u) => orderOf.get(u.id) !== u.sortOrder)
      .map((u) =>
        db.update(schema.units).set({ sortOrder: u.sortOrder }).where(eq(schema.units.id, u.id)),
      )
    if (updates.length) await db.batch(updates as [(typeof updates)[number], ...typeof updates])
    return { updated: updates.length }
  })

/** Arsip materi beserta sub-topiknya. Log lama tetap tersimpan. */
export const archiveUnit = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(z.object({ unitId: z.string() }))
  .handler(async ({ data, context }) => {
    const { unit } = await getUnitForFamily(data.unitId, context.familyId)
    const db = getDb()
    const all = await db
      .select({ id: schema.units.id, parentId: schema.units.parentId })
      .from(schema.units)
      .where(
        and(eq(schema.units.subjectId, unit.subjectId), isNull(schema.units.archivedAt)),
      )

    const ids = new Set([unit.id])
    let grew = true
    while (grew) {
      grew = false
      for (const u of all) {
        if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) {
          ids.add(u.id)
          grew = true
        }
      }
    }

    const now = new Date()
    const updates = [...ids].map((id) =>
      db.update(schema.units).set({ archivedAt: now }).where(eq(schema.units.id, id)),
    )
    await db.batch(updates as [(typeof updates)[number], ...typeof updates])
    return { id: unit.id }
  })
