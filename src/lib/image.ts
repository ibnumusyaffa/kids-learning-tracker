/**
 * Kompres foto di browser sebelum upload: WebP, sisi terpanjang maks 1600px.
 * Foto HP bisa 5-10 MB; hasilnya biasanya < 300 KB.
 */
export const MAX_IMAGE_SIDE = 1600

export async function compressImage(file: File, quality = 0.8): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak tersedia')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  )
  // Browser lama tanpa dukungan WebP mengembalikan PNG; pakai JPEG saja.
  const out =
    blob && blob.type === 'image/webp'
      ? blob
      : await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality),
        )
  if (!out) throw new Error('Gagal mengompres foto')
  const ext = out.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([out], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, {
    type: out.type,
  })
}
