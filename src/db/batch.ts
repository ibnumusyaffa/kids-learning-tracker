/**
 * D1 membatasi 100 parameter per statement. Insert banyak baris harus dipecah.
 */
export const D1_MAX_PARAMS = 100

export function chunkRows<T extends Record<string, unknown>>(rows: T[]): T[][] {
  if (rows.length === 0) return []
  const columns = Math.max(1, Object.keys(rows[0]).length)
  const size = Math.max(1, Math.floor(D1_MAX_PARAMS / columns))
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}
