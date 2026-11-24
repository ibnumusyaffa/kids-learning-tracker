import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { todayIn } from '@/lib/dates'
import { getDb, schema } from '@/db'
import { getChildForFamily } from './access.server'
import { familyMiddleware } from './family'

export const listChildren = createServerFn({ method: 'GET' })
  .middleware([familyMiddleware])
  .handler(async ({ context }) => {
    return getDb()
      .select({
        id: schema.children.id,
        name: schema.children.name,
        avatar: schema.children.avatar,
        birthDate: schema.children.birthDate,
      })
      .from(schema.children)
      .where(
        and(
          eq(schema.children.familyId, context.familyId),
          isNull(schema.children.archivedAt),
        ),
      )
      .orderBy(asc(schema.children.createdAt))
  })

const createChildInput = z.object({
  name: z.string().trim().min(1).max(60),
  avatar: z.string().max(16).optional(),
  birthDate: z.iso.date().optional(),
})

export const createChild = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(createChildInput)
  .handler(async ({ data, context }) => {
    if (data.birthDate && data.birthDate > todayIn(context.timezone)) throw new Error('FUTURE_BIRTH_DATE')
    const [child] = await getDb()
      .insert(schema.children)
      .values({
        familyId: context.familyId,
        name: data.name,
        avatar: data.avatar || null,
        birthDate: data.birthDate ?? null,
      })
      .returning({ id: schema.children.id })
    return child
  })

export const updateChild = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(createChildInput.extend({ childId: z.string() }))
  .handler(async ({ data, context }) => {
    const child = await getChildForFamily(data.childId, context.familyId)
    if (data.birthDate && data.birthDate > todayIn(context.timezone)) throw new Error('FUTURE_BIRTH_DATE')
    await getDb()
      .update(schema.children)
      .set({
        name: data.name,
        avatar: data.avatar || null,
        birthDate: data.birthDate ?? null,
      })
      .where(eq(schema.children.id, child.id))
    return { id: child.id }
  })

/** Arsip (bukan hapus) supaya log lama tidak hilang. */
export const archiveChild = createServerFn({ method: 'POST' })
  .middleware([familyMiddleware])
  .validator(z.object({ childId: z.string() }))
  .handler(async ({ data, context }) => {
    const child = await getChildForFamily(data.childId, context.familyId)
    await getDb()
      .update(schema.children)
      .set({ archivedAt: new Date() })
      .where(eq(schema.children.id, child.id))
    return { id: child.id }
  })
