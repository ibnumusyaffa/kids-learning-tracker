/**
 * Server function log (catatan belajar). Lihat docs.md bagian 5.8 & 7.3.
 */
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/db'
import { MASTERY_LEVELS } from '@/db/enums'
import { todayIn } from '@/lib/dates'
import {
  getAttachmentForFamily,
  getLogForFamily,
  getSubjectForFamily,
} from './access.server'
import { familyMiddleware } from './family'
import {
  assertNotFuture,
  deleteLogCascade,
  logFields,
  masteryUnitsOfLog,
  prepareItems,
  recomputeMastery,
  runBatch,
} from './logs.server'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENTS_PER_LOG,
  MAX_UPLOAD_BYTES,
  attachmentKey,
  deleteObjects,
  getBucket,
} from './storage.server'

const count = z.number().int().min(0).max(100_000)

const logItemInput = z.object({
  unitId: z.string().nullish(),
  newUnit: z
    .object({
      label: z.string().max(120),
      meaning: z.string().max(200).nullish(),
      tags: z.array(z.string().max(30)).max(10).optional(),
      size: z.number().int().positive().max(100_000).nullish(),
    })
    .nullish(),
  rangeFrom: count.nullish(),
  rangeTo: count.nullish(),
  masteryAfter: z.enum(MASTERY_LEVELS).nullish(),
})

const logFieldsInput = z.object({
  date: z.iso.date(),
  durationMin: z.number().int().min(0).max(1440).nullish(),
  mood: z.string().max(8).nullish(),
  note: z.string().max(2000).nullish(),
  items: z.array(logItemInput).max(50),
})

// ---------------------------------------------------------------------------
// Buat, ubah, hapus
// ---------------------------------------------------------------------------

export const createLog = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(logFieldsInput.extend({ subjectId: z.string() }))
  .handler(async ({ data, context }) => {
    const { subject } = await getSubjectForFamily(data.subjectId, context.familyId)
    assertNotFuture(data.date, todayIn(context.timezone))

    const logId = crypto.randomUUID()
    const { statements, touchedMastery } = await prepareItems(subject, logId, data.items)

    const db = getDb()
    await runBatch([
      db.insert(schema.logs).values({
        id: logId,
        childId: subject.childId,
        subjectId: subject.id,
        loggedBy: context.userId,
        createdAt: new Date(),
        ...logFields(data),
      }),
      ...statements,
      ...recomputeMastery(touchedMastery),
    ])
    return { id: logId }
  })

export const updateLog = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(logFieldsInput.extend({ logId: z.string() }))
  .handler(async ({ data, context }) => {
    const { log, subject } = await getLogForFamily(data.logId, context.familyId)
    assertNotFuture(data.date, todayIn(context.timezone))

    const before = await masteryUnitsOfLog(log.id)
    const { statements, touchedMastery } = await prepareItems(subject, log.id, data.items)

    const db = getDb()
    await runBatch([
      db.update(schema.logs).set(logFields(data)).where(eq(schema.logs.id, log.id)),
      db.delete(schema.logItems).where(eq(schema.logItems.logId, log.id)),
      ...statements,
      ...recomputeMastery(new Set([...before, ...touchedMastery])),
    ])
    return { id: log.id }
  })

export const deleteLog = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(z.object({ logId: z.string() }))
  .handler(async ({ data, context }) => {
    const { log } = await getLogForFamily(data.logId, context.familyId)
    await deleteLogCascade(log.id)
    return { subjectId: log.subjectId }
  })

// ---------------------------------------------------------------------------
// Riwayat
// ---------------------------------------------------------------------------

export const LOG_PAGE_SIZE = 20

export const listLogs = createServerFn({ method: 'GET' })
  .middleware([familyMiddleware])
  .validator(
    z.object({ subjectId: z.string(), offset: z.number().int().min(0).default(0) }),
  )
  .handler(async ({ data, context }) => {
    const { subject } = await getSubjectForFamily(data.subjectId, context.familyId)
    const db = getDb()

    const rows = await db
      .select({ log: schema.logs, loggedByName: schema.user.name })
      .from(schema.logs)
      .innerJoin(schema.user, eq(schema.logs.loggedBy, schema.user.id))
      .where(eq(schema.logs.subjectId, subject.id))
      .orderBy(desc(schema.logs.date), desc(schema.logs.createdAt))
      .limit(LOG_PAGE_SIZE + 1)
      .offset(data.offset)

    const page = rows.slice(0, LOG_PAGE_SIZE)
    const ids = page.map((r) => r.log.id)
    const [items, files] = ids.length
      ? await Promise.all([
          db
            .select({
              logId: schema.logItems.logId,
              unitId: schema.logItems.unitId,
              unitLabel: schema.units.label,
              rangeFrom: schema.logItems.rangeFrom,
              rangeTo: schema.logItems.rangeTo,
              masteryAfter: schema.logItems.masteryAfter,
            })
            .from(schema.logItems)
            .innerJoin(schema.units, eq(schema.logItems.unitId, schema.units.id))
            .where(inArray(schema.logItems.logId, ids)),
          db
            .select({ id: schema.attachments.id, logId: schema.attachments.logId })
            .from(schema.attachments)
            .where(inArray(schema.attachments.logId, ids))
            .orderBy(schema.attachments.createdAt),
        ])
      : [[], []]

    return {
      hasMore: rows.length > LOG_PAGE_SIZE,
      logs: page.map(({ log, loggedByName }) => ({
        id: log.id,
        date: log.date,
        durationMin: log.durationMin,
        mood: log.mood,
        note: log.note,
        loggedByName,
        items: items
          .filter((i) => i.logId === log.id)
          .map(({ logId: _, ...i }) => i),
        attachmentIds: files.filter((f) => f.logId === log.id).map((f) => f.id),
      })),
    }
  })

// ---------------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------------

export const uploadAttachment = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Harus FormData')
    const logId = data.get('logId')
    const file = data.get('file')
    if (typeof logId !== 'string' || !(file instanceof File)) {
      throw new Error('logId dan file wajib')
    }
    return { logId, file }
  })
  .handler(async ({ data, context }) => {
    const { log } = await getLogForFamily(data.logId, context.familyId)
    const { file } = data
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      throw new Error('UNSUPPORTED_TYPE')
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('FILE_TOO_LARGE')

    const db = getDb()
    const existing = await db
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(eq(schema.attachments.logId, log.id))
    if (existing.length >= MAX_ATTACHMENTS_PER_LOG) throw new Error('TOO_MANY_FILES')

    const key = attachmentKey(context.familyId, log.id, file.type)
    await getBucket().put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })
    try {
      const [row] = await db
        .insert(schema.attachments)
        .values({
          logId: log.id,
          r2Key: key,
          contentType: file.type,
          sizeBytes: file.size,
        })
        .returning({ id: schema.attachments.id })
      return row
    } catch (err) {
      await deleteObjects([key])
      throw err
    }
  })

export const deleteAttachment = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(z.object({ attachmentId: z.string() }))
  .handler(async ({ data, context }) => {
    const attachment = await getAttachmentForFamily(data.attachmentId, context.familyId)
    await getDb()
      .delete(schema.attachments)
      .where(
        and(
          eq(schema.attachments.id, attachment.id),
          eq(schema.attachments.logId, attachment.logId),
        ),
      )
    await deleteObjects([attachment.r2Key])
    return { id: attachment.id }
  })
