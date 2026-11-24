/**
 * Menyajikan foto dari bucket R2 privat. Hanya anggota keluarga pemilik log
 * yang boleh membaca; selain itu 404 (tidak membocorkan keberadaan file).
 */
import { createFileRoute } from '@tanstack/react-router'
import { getAttachmentForFamily } from '@/server/access.server'
import { loadViewer } from '@/server/family.server'
import { getBucket } from '@/server/storage.server'

const notFound = () => new Response('Not found', { status: 404 })

export const Route = createFileRoute('/api/files/$attachmentId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const viewer = await loadViewer(request.headers)
        if (!viewer?.family) return new Response('Unauthorized', { status: 401 })

        let attachment
        try {
          attachment = await getAttachmentForFamily(params.attachmentId, viewer.family.id)
        } catch {
          return notFound()
        }

        const object = await getBucket().get(attachment.r2Key)
        if (!object) return notFound()

        return new Response(object.body, {
          headers: {
            'content-type': attachment.contentType,
            'cache-control': 'private, max-age=3600',
            etag: object.httpEtag,
            'x-content-type-options': 'nosniff',
          },
        })
      },
    },
  },
})
