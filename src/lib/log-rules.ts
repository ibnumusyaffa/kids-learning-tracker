/**
 * Aturan isi log per bentuk materi. Murni (tanpa DB), dipakai server untuk
 * validasi dan bisa dites langsung. Lihat docs.md bagian 3 & 5.8.
 */
import type { MasteryLevel, Structure } from '@/db/enums'

export class LogRuleError extends Error {
  constructor(
    readonly code: string,
    readonly index?: number,
  ) {
    super(index === undefined ? code : `${code}#${index}`)
  }
}

export type NewUnitInput = {
  label: string
  meaning?: string | null
  tags?: string[]
  size?: number | null
}

export type LogItemInput = {
  unitId?: string | null
  newUnit?: NewUnitInput | null
  rangeFrom?: number | null
  rangeTo?: number | null
  masteryAfter?: MasteryLevel | null
}

export type NormalizedLogItem = {
  unit:
    | { kind: 'existing'; id: string }
    | {
        kind: 'new'
        label: string
        meaning: string | null
        tags: string[]
        size: number | null
      }
  rangeFrom: number | null
  rangeTo: number | null
  masteryAfter: MasteryLevel | null
}

export const MAX_LOG_ITEMS = 50

const isSet = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined

export function normalizeLogItems(
  subject: { structure: Structure; openEnded: boolean },
  /** `isParent`: materi punya sub-topik → tidak bisa dicatat langsung. */
  units: Map<string, { size: number | null; isParent?: boolean }>,
  items: LogItemInput[],
): NormalizedLogItem[] {
  if (subject.structure === 'none') {
    if (items.length > 0) throw new LogRuleError('NO_ITEMS_FOR_HABIT')
    return []
  }
  if (items.length === 0) throw new LogRuleError('ITEMS_REQUIRED')
  if (items.length > MAX_LOG_ITEMS) throw new LogRuleError('TOO_MANY_ITEMS')

  const seen = new Set<string>()

  return items.map((item, i) => {
    const hasExisting = Boolean(item.unitId)
    const hasNew = Boolean(item.newUnit)
    if (hasExisting === hasNew) throw new LogRuleError('UNIT_REQUIRED', i)

    let unit: NormalizedLogItem['unit']
    let size: number | null

    if (item.unitId) {
      const found = units.get(item.unitId)
      if (!found) throw new LogRuleError('UNIT_NOT_FOUND', i)
      if (found.isParent) throw new LogRuleError('PARENT_UNIT', i)
      // Range boleh menyentuh materi yang sama 2x (mis. ayat 1-5 & 20-25).
      if (subject.structure === 'checklist' && seen.has(item.unitId)) {
        throw new LogRuleError('DUPLICATE_UNIT', i)
      }
      seen.add(item.unitId)
      unit = { kind: 'existing', id: item.unitId }
      size = found.size
    } else {
      if (!subject.openEnded) throw new LogRuleError('NOT_OPEN_ENDED', i)
      const n = item.newUnit!
      const label = n.label.trim()
      if (!label) throw new LogRuleError('LABEL_REQUIRED', i)
      size = subject.structure === 'range' ? (n.size ?? null) : null
      if (subject.structure === 'range' && !(size && size > 0)) {
        throw new LogRuleError('SIZE_REQUIRED', i)
      }
      unit = {
        kind: 'new',
        label,
        meaning: n.meaning?.trim() || null,
        tags: (n.tags ?? []).map((t) => t.trim()).filter(Boolean),
        size,
      }
    }

    let rangeFrom: number | null = null
    let rangeTo: number | null = null
    if (subject.structure === 'range') {
      if (isSet(item.rangeFrom) !== isSet(item.rangeTo)) {
        throw new LogRuleError('RANGE_INCOMPLETE', i)
      }
      if (isSet(item.rangeFrom) && isSet(item.rangeTo)) {
        if (
          !Number.isInteger(item.rangeFrom) ||
          !Number.isInteger(item.rangeTo) ||
          item.rangeFrom < 1 ||
          item.rangeFrom > item.rangeTo ||
          (size !== null && item.rangeTo > size)
        ) {
          throw new LogRuleError('RANGE_OUT_OF_BOUNDS', i)
        }
        rangeFrom = item.rangeFrom
        rangeTo = item.rangeTo
      }
    }


    return {
      unit,
      rangeFrom,
      rangeTo,
      masteryAfter: item.masteryAfter ?? null,
    }
  })
}

/** Pesan ramah untuk kode error di atas. */
export const LOG_RULE_MESSAGES: Record<string, string> = {
  NO_ITEMS_FOR_HABIT: 'Kebiasaan harian tidak punya materi.',
  ITEMS_REQUIRED: 'Pilih minimal satu materi.',
  TOO_MANY_ITEMS: `Maksimal ${MAX_LOG_ITEMS} materi per catatan.`,
  UNIT_REQUIRED: 'Pilih materi.',
  UNIT_NOT_FOUND: 'Materi tidak ditemukan.',
  PARENT_UNIT: 'Pilih sub-topiknya, bukan topik induk.',
  DUPLICATE_UNIT: 'Topik yang sama dipilih dua kali.',
  NOT_OPEN_ENDED: 'Pelajaran ini tidak menerima materi baru dari catatan.',
  LABEL_REQUIRED: 'Nama materi baru wajib diisi.',
  SIZE_REQUIRED: 'Jumlah ayat/halaman materi baru wajib diisi.',
  RANGE_INCOMPLETE: 'Isi "dari" dan "sampai", atau kosongkan keduanya.',
  RANGE_OUT_OF_BOUNDS: 'Rentang di luar ukuran materi.',
  FUTURE_DATE: 'Tanggal tidak boleh setelah hari ini.',
}

export function logErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const code = raw.split('#')[0]
  return LOG_RULE_MESSAGES[code] ?? 'Gagal menyimpan catatan.'
}
