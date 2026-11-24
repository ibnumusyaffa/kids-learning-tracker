/**
 * Helper server-only untuk session & keluarga.
 * Jangan di-import langsung dari komponen; pakai lewat server function.
 */
import '@tanstack/react-start/server-only'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { getAuth } from '@/lib/auth'

export type Viewer = {
  user: { id: string; name: string; email: string; image: string | null }
  family: { id: string; name: string; timezone: string } | null
}

/**
 * Baca session + keluarga aktif. `headers` diisi saat dipanggil dari server
 * route (mis. /api/files); di server function cukup tanpa argumen.
 */
export async function loadViewer(
  headers: Headers = getRequestHeaders(),
): Promise<Viewer | null> {
  const session = await getAuth().api.getSession({ headers })
  if (!session) return null

  const db = getDb()
  const memberships = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      timezone: schema.organization.timezone,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(eq(schema.member.userId, session.user.id))
    .orderBy(asc(schema.member.createdAt))

  // Keluarga aktif di session harus tetap dicek keanggotaannya.
  const active = session.session.activeOrganizationId
  const family =
    memberships.find((m) => m.id === active) ?? memberships[0] ?? null

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    family,
  }
}
