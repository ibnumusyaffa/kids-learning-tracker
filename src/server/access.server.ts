/**
 * Cek kepemilikan data terhadap keluarga aktif. Server-only.
 *
 * Setiap server function yang menerima id dari client (childId, subjectId,
 * unitId) WAJIB memanggil salah satu helper ini sebelum membaca/menulis.
 * Semua helper melempar notFound() kalau data bukan milik keluarga, supaya
 * tidak membocorkan keberadaan data keluarga lain.
 */
import '@tanstack/react-start/server-only'
import { notFound } from '@tanstack/react-router'
import { and, eq, isNull } from 'drizzle-orm'
import { getDb, schema } from '@/db'

/** Dilempar sebagai `notFound()` supaya router menampilkan halaman 404. */
export function notFoundError() {
  return notFound()
}

export async function getChildForFamily(childId: string, familyId: string) {
  const [child] = await getDb()
    .select()
    .from(schema.children)
    .where(
      and(
        eq(schema.children.id, childId),
        eq(schema.children.familyId, familyId),
        isNull(schema.children.archivedAt),
      ),
    )
    .limit(1)
  if (!child) throw notFoundError()
  return child
}

export async function getSubjectForFamily(subjectId: string, familyId: string) {
  const [row] = await getDb()
    .select({ subject: schema.subjects, child: schema.children })
    .from(schema.subjects)
    .innerJoin(schema.children, eq(schema.subjects.childId, schema.children.id))
    .where(
      and(
        eq(schema.subjects.id, subjectId),
        eq(schema.children.familyId, familyId),
        isNull(schema.subjects.archivedAt),
        isNull(schema.children.archivedAt),
      ),
    )
    .limit(1)
  if (!row) throw notFoundError()
  return row
}

export async function getUnitForFamily(unitId: string, familyId: string) {
  const [row] = await getDb()
    .select({ unit: schema.units, subject: schema.subjects })
    .from(schema.units)
    .innerJoin(schema.subjects, eq(schema.units.subjectId, schema.subjects.id))
    .innerJoin(schema.children, eq(schema.subjects.childId, schema.children.id))
    .where(
      and(
        eq(schema.units.id, unitId),
        eq(schema.children.familyId, familyId),
        isNull(schema.units.archivedAt),
        isNull(schema.subjects.archivedAt),
      ),
    )
    .limit(1)
  if (!row) throw notFoundError()
  return row
}

export async function assertCategoryInFamily(
  categoryId: string | null | undefined,
  familyId: string,
) {
  if (!categoryId) return
  const [row] = await getDb()
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.id, categoryId),
        eq(schema.categories.familyId, familyId),
      ),
    )
    .limit(1)
  if (!row) throw notFoundError()
}

/** Pelajaran sudah punya log → `structure` terkunci. */
export async function subjectHasLogs(subjectId: string) {
  const [row] = await getDb()
    .select({ id: schema.logs.id })
    .from(schema.logs)
    .where(eq(schema.logs.subjectId, subjectId))
    .limit(1)
  return Boolean(row)
}

export async function getLogForFamily(logId: string, familyId: string) {
  const [row] = await getDb()
    .select({ log: schema.logs, subject: schema.subjects, child: schema.children })
    .from(schema.logs)
    .innerJoin(schema.subjects, eq(schema.logs.subjectId, schema.subjects.id))
    .innerJoin(schema.children, eq(schema.logs.childId, schema.children.id))
    .where(and(eq(schema.logs.id, logId), eq(schema.children.familyId, familyId)))
    .limit(1)
  if (!row) throw notFoundError()
  return row
}

export async function getAttachmentForFamily(attachmentId: string, familyId: string) {
  const [row] = await getDb()
    .select({ attachment: schema.attachments })
    .from(schema.attachments)
    .innerJoin(schema.logs, eq(schema.attachments.logId, schema.logs.id))
    .innerJoin(schema.children, eq(schema.logs.childId, schema.children.id))
    .where(
      and(
        eq(schema.attachments.id, attachmentId),
        eq(schema.children.familyId, familyId),
      ),
    )
    .limit(1)
  if (!row) throw notFoundError()
  return row.attachment
}
