/**
 * Session & isolasi data keluarga.
 *
 * Semua server function yang menyentuh data domain WAJIB memakai
 * `familyMiddleware`, lalu memfilter query dengan `context.familyId`.
 * Lihat docs.md bagian 10.3.
 */
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getDb, schema } from '@/db'
import { DEFAULT_TIMEZONE, getAuth } from '@/lib/auth'
import { loadViewer } from './family.server'

export type { Viewer } from './family.server'

export const getViewer = createServerFn({ method: 'GET' }).handler(() =>
  loadViewer(),
)

export const familyMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const viewer = await loadViewer()
    if (!viewer) throw new Error('UNAUTHENTICATED')
    if (!viewer.family) throw new Error('NO_FAMILY')
    return next({
      context: {
        userId: viewer.user.id,
        familyId: viewer.family.id,
        timezone: viewer.family.timezone,
      },
    })
  },
)

const createFamilyInput = z.object({
  name: z.string().trim().min(1).max(80),
})

export const createFamily = createServerFn({ method: 'POST' })
  .validator(createFamilyInput)
  .handler(async ({ data }) => {
    const auth = getAuth()
    const headers = getRequestHeaders()
    const org = await auth.api.createOrganization({
      headers,
      body: {
        name: data.name,
        slug: `fam-${crypto.randomUUID().slice(0, 8)}`,
        timezone: DEFAULT_TIMEZONE,
      },
    })
    if (!org) throw new Error('Gagal membuat keluarga')

    const db = getDb()
    await db.insert(schema.categories).values(
      [
        { name: 'Quran', color: 'green' },
        { name: 'Sekolah', color: 'blue' },
        { name: 'Kebiasaan', color: 'orange' },
      ].map((c, i) => ({ ...c, familyId: org.id, sortOrder: i })),
    )
    return { id: org.id }
  })
