/**
 * Helper server-only untuk materi (units).
 */
import '@tanstack/react-start/server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { notFoundError } from './access.server'

export type UnitFieldsInput = {
  label: string
  size?: number | null
  parentId?: string | null
  meaning?: string | null
  tags: string[]
}

type Subject = typeof schema.subjects.$inferSelect

/** Validasi field materi sesuai bentuk pelajaran. */
export function normalizeFields(subject: Subject, data: UnitFieldsInput) {
  if (subject.structure === 'none') throw new Error('NO_UNITS_FOR_HABIT')
  if (subject.structure === 'range' && !data.size) throw new Error('SIZE_REQUIRED')
  return {
    label: data.label,
    size: subject.structure === 'range' ? (data.size ?? null) : null,
    // Hierarki hanya untuk checklist.
    parentId: subject.structure === 'checklist' ? (data.parentId ?? null) : null,
    meaning: data.meaning || null,
    tags: data.tags,
  }
}

/** Parent harus materi aktif di pelajaran yang sama dan tidak membuat siklus. */
export async function assertValidParent(
  subjectId: string,
  parentId: string | null,
  unitId?: string,
) {
  if (!parentId) return
  const db = getDb()
  let current: string | null = parentId
  for (let depth = 0; current; depth++) {
    if (current === unitId || depth > 20) throw new Error('INVALID_PARENT')
    const [row] = await db
      .select({ parentId: schema.units.parentId })
      .from(schema.units)
      .where(
        and(
          eq(schema.units.id, current),
          eq(schema.units.subjectId, subjectId),
          isNull(schema.units.archivedAt),
        ),
      )
      .limit(1)
    if (!row) throw notFoundError()
    current = row.parentId
  }
}
