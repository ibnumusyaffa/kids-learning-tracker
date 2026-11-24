/**
 * Penyimpanan file di R2 (bucket privat). Server-only.
 * File hanya bisa dibaca lewat /api/files/$attachmentId yang mengecek akses.
 */
import '@tanstack/react-start/server-only'
import { env } from 'cloudflare:workers'

export const ALLOWED_IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_LOG = 6

const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export function attachmentKey(familyId: string, logId: string, contentType: string) {
  return `fam_${familyId}/logs/${logId}/${crypto.randomUUID()}.${EXT[contentType] ?? 'bin'}`
}

export function getBucket() {
  return env.BUCKET
}

/** Hapus banyak objek; kegagalan dicatat tapi tidak menggagalkan request. */
export async function deleteObjects(keys: string[]) {
  // R2 menerima maksimal 1000 key per panggilan delete.
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000)
    try {
      await getBucket().delete(chunk)
    } catch (err) {
      console.error('Gagal menghapus file R2', chunk, err)
    }
  }
}
