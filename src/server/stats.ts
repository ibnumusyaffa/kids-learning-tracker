/**
 * Statistik per anak. Lihat docs.md bagian 9 (MVP: heatmap, streak, peta
 * hafalan) dan TODO M4.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { familyMiddleware } from './family'
import { buildChildStats } from './stats.server'

export type { ChildStats } from './stats.server'

export const getChildStats = createServerFn({ method: 'GET' })
  .middleware([familyMiddleware])
  .validator(z.object({ childId: z.string() }))
  .handler(({ data, context }) => buildChildStats(data.childId, context.familyId, context.timezone))
