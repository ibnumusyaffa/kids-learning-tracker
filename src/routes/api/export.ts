/**
 * Unduh data keluarga aktif.
 *   /api/export            → JSON lengkap
 *   /api/export?format=csv → CSV catatan belajar
 */
import { createFileRoute } from '@tanstack/react-router'
import { todayIn } from '@/lib/dates'
import { exportFamily, logsToCsv } from '@/server/export.server'
import { loadViewer } from '@/server/family.server'

export const Route = createFileRoute('/api/export')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const viewer = await loadViewer(request.headers)
        if (!viewer?.family) return new Response('Unauthorized', { status: 401 })

        const data = await exportFamily(viewer.family.id)
        const date = todayIn(viewer.family.timezone)
        const csv = new URL(request.url).searchParams.get('format') === 'csv'
        const name = `kids-tracker-${date}.${csv ? 'csv' : 'json'}`

        return new Response(csv ? logsToCsv(data) : JSON.stringify(data, null, 2), {
          headers: {
            'content-type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
            'content-disposition': `attachment; filename="${name}"`,
            'cache-control': 'no-store',
          },
        })
      },
    },
  },
})
