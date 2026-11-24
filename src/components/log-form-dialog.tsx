/**
 * Form catat log. Bentuk field mengikuti bentuk materi pelajaran:
 * - range: pilih materi + rentang opsional (kosong = seluruh materi)
 * - checklist: pilih topik + level
 * - none: cukup tanggal, menit, catatan
 * Lihat docs.md bagian 7.3.
 */
import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MasteryPicker } from '@/components/mastery'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  type MasteryLevel,
  type Structure,
  type SuggestOrder,
} from '@/db/enums'
import { todayIn } from '@/lib/dates'
import { compressImage } from '@/lib/image'
import { type LogItemInput, logErrorMessage } from '@/lib/log-rules'
import { suggestRange } from '@/lib/suggest'
import { cn } from '@/lib/utils'
import {
  createLog,
  deleteAttachment,
  updateLog,
  uploadAttachment,
} from '@/server/logs'

// ---------------------------------------------------------------------------
// Tipe
// ---------------------------------------------------------------------------

export type LogFormUnit = {
  id: string
  parentId: string | null
  label: string
  size: number | null
  mastery: MasteryLevel | null
  sortOrder: number
  progress: {
    covered: number
    done: boolean
    nextGap: [number, number] | null
  } | null
}

export type LogFormSubject = {
  id: string
  structure: Structure
  openEnded: boolean
  unitLabel: string | null
  suggestOrder: SuggestOrder
}

export type EditableLog = {
  id: string
  date: string
  durationMin: number | null
  mood: string | null
  note: string | null
  items: {
    unitId: string
    rangeFrom: number | null
    rangeTo: number | null
    masteryAfter: MasteryLevel | null
  }[]
  attachmentIds: string[]
}

/** Isian awal dari layar Hari Ini (saran / perlu diulang). */
export type LogPrefill = {
  items?: { unitId: string; from: number | null; to: number | null }[]
}

type ItemState = {
  key: string
  mode: 'existing' | 'new'
  unitId: string
  newLabel: string
  newMeaning: string
  newSize: string
  from: string
  to: string
  mastery: MasteryLevel | null
}

const MOODS = ['😄', '🙂', '😐', '😩']
const DURATIONS = [5, 10, 15, 20, 30]

/**
 * Isian default catatan baru. Durasi & mood mengikuti catatan terakhir
 * pelajaran itu (lihat `lastLog` di getSubjectDetail), level mengikuti level
 * materi saat ini.
 */
export const LOG_DEFAULTS = {
  durationMin: 15,
  mood: '🙂',
  mastery: 'kenal' as MasteryLevel,
}

const defaultMastery = (unit?: { mastery: MasteryLevel | null } | null) =>
  unit?.mastery ?? LOG_DEFAULTS.mastery

const str = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(n)
const num = (s: string) => (s.trim() === '' ? null : Number(s))

function emptyItem(partial: Partial<ItemState> = {}): ItemState {
  return {
    key: crypto.randomUUID(),
    mode: 'existing',
    unitId: '',
    newLabel: '',
    newMeaning: '',
    newSize: '',
    from: '',
    to: '',
    mastery: LOG_DEFAULTS.mastery,
    ...partial,
  }
}

function initialItems(
  subject: LogFormSubject,
  units: LogFormUnit[],
  log?: EditableLog,
  prefill?: LogPrefill,
): ItemState[] {
  if (subject.structure === 'none') return []
  if (!log && prefill?.items?.length) {
    const known = new Map(units.map((u) => [u.id, u]))
    const items = prefill.items
      .filter((i) => known.has(i.unitId))
      .map((i) =>
        emptyItem({
          unitId: i.unitId,
          from: str(i.from),
          to: str(i.to),
          mastery: defaultMastery(known.get(i.unitId)),
        }),
      )
    if (items.length) return items
  }
  if (log) {
    return log.items.map((i) =>
      emptyItem({
        unitId: i.unitId,
        from: str(i.rangeFrom),
        to: str(i.rangeTo),
        mastery: i.masteryAfter,
      }),
    )
  }
  if (subject.structure === 'range') {
    const s = suggestRange(units, subject.suggestOrder)
    const unit = s ? units.find((u) => u.id === s.unitId) : null
    return [
      emptyItem({
        unitId: s?.unitId ?? '',
        from: str(s?.from),
        to: str(s?.to),
        mastery: defaultMastery(unit),
      }),
    ]
  }
  return [emptyItem()]
}

// ---------------------------------------------------------------------------
// Komponen
// ---------------------------------------------------------------------------

export function LogFormDialog({
  open,
  onOpenChange,
  subject,
  units,
  timezone,
  log,
  prefill,
  lastLog,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: LogFormSubject
  units: LogFormUnit[]
  timezone: string
  /** Kosong = catatan baru. */
  log?: EditableLog
  prefill?: LogPrefill
  /** Catatan terakhir pelajaran ini, untuk default durasi & mood. */
  lastLog?: { durationMin: number | null; mood: string | null } | null
  onSaved: () => Promise<void> | void
}) {
  const today = todayIn(timezone)
  const [date, setDate] = useState(log?.date ?? today)
  const [duration, setDuration] = useState(
    log ? str(log.durationMin) : str(lastLog?.durationMin ?? LOG_DEFAULTS.durationMin),
  )
  const [mood, setMood] = useState<string | null>(
    log ? log.mood : (lastLog?.mood ?? LOG_DEFAULTS.mood),
  )
  const [note, setNote] = useState(log?.note ?? '')
  const [items, setItems] = useState(() => initialItems(subject, units, log, prefill))
  const [photos, setPhotos] = useState<File[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [pending, setPending] = useState(false)

  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])
  // Hanya materi paling bawah (tanpa sub-topik) yang bisa dicatat; topik
  // induk tampil sebagai judul grup.
  const unitGroups = useMemo(() => {
    const kids = new Map<string | null, LogFormUnit[]>()
    for (const u of units) {
      const key = u.parentId && unitById.has(u.parentId) ? u.parentId : null
      kids.set(key, [...(kids.get(key) ?? []), u])
    }
    for (const list of kids.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)

    type Option = { id: string; label: string; unit: LogFormUnit }
    const leaves = (id: string, prefix: string): Option[] =>
      (kids.get(id) ?? []).flatMap((u) => {
        const label = prefix ? `${prefix} › ${u.label}` : u.label
        return kids.get(u.id)?.length ? leaves(u.id, label) : [{ id: u.id, label, unit: u }]
      })

    return (kids.get(null) ?? []).map((root) =>
      kids.get(root.id)?.length
        ? { kind: 'group' as const, id: root.id, label: root.label, options: leaves(root.id, '') }
        : { kind: 'item' as const, id: root.id, label: root.label, options: [{ id: root.id, label: root.label, unit: root }] },
    )
  }, [units, unitById])

  const isRange = subject.structure === 'range'
  const unitWord = subject.unitLabel ?? (isRange ? 'bagian' : '')

  function updateItem(key: string, patch: Partial<ItemState>) {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payloadItems: LogItemInput[] = items.map((i) => ({
      unitId: i.mode === 'existing' ? i.unitId || null : null,
      newUnit:
        i.mode === 'new'
          ? {
              label: i.newLabel,
              meaning: i.newMeaning || null,
              size: isRange ? num(i.newSize) : null,
            }
          : null,
      rangeFrom: isRange ? num(i.from) : null,
      rangeTo: isRange ? num(i.to) : null,
      masteryAfter: i.mastery,
    }))
    const fields = {
      date,
      durationMin: num(duration),
      mood,
      note: note || null,
      items: payloadItems,
    }

    setPending(true)
    try {
      const { id } = log
        ? await updateLog({ data: { ...fields, logId: log.id } })
        : await createLog({ data: { ...fields, subjectId: subject.id } })

      let failedPhotos = 0
      for (const attachmentId of removed) {
        await deleteAttachment({ data: { attachmentId } }).catch(() => failedPhotos++)
      }
      for (const photo of photos) {
        try {
          const form = new FormData()
          form.set('logId', id)
          form.set('file', await compressImage(photo))
          await uploadAttachment({ data: form })
        } catch {
          failedPhotos++
        }
      }

      if (failedPhotos) toast.warning(`Catatan tersimpan, ${failedPhotos} foto gagal diproses`)
      else toast.success(log ? 'Catatan diperbarui' : 'Catatan disimpan')
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error(logErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  const existingPhotos = (log?.attachmentIds ?? []).filter((id) => !removed.includes(id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{log ? 'Edit catatan' : 'Catat belajar'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="log-date">Tanggal</Label>
            <Input
              id="log-date"
              type="date"
              required
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Materi */}
          {items.map((item, index) => {
            const unit = unitById.get(item.unitId)
            const size = item.mode === 'new' ? num(item.newSize) : (unit?.size ?? null)
            return (
              <fieldset key={item.key} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-medium">
                    Materi{items.length > 1 ? ` ${index + 1}` : ''}
                  </legend>
                  <div className="flex gap-1">
                    {subject.openEnded && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateItem(item.key, {
                            mode: item.mode === 'new' ? 'existing' : 'new',
                          })
                        }
                      >
                        {item.mode === 'new' ? 'Pilih yang ada' : '+ Materi baru'}
                      </Button>
                    )}
                    {items.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Hapus materi"
                        onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                </div>

                {item.mode === 'existing' ? (
                  <Select
                    value={item.unitId}
                    onValueChange={(v) => {
                      const u = unitById.get(v)
                      const gap = u?.progress && !u.progress.done ? u.progress.nextGap : null
                      updateItem(item.key, {
                        unitId: v,
                        mastery: defaultMastery(u),
                        from: u?.progress?.covered ? str(gap?.[0]) : '',
                        to: u?.progress?.covered ? str(gap?.[1]) : '',
                      })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih materi" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitGroups.map((g) =>
                        g.kind === 'group' ? (
                          <SelectGroup key={g.id}>
                            <SelectLabel>{g.label}</SelectLabel>
                            {g.options.map((o) => (
                              <SelectItem key={o.id} value={o.id} className="pl-5">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ) : (
                          <SelectItem key={g.id} value={g.id}>
                            {g.label}
                            {g.options[0].unit.progress?.done ? ' ✓' : ''}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={isRange ? 'Judul' : 'Kata / item'}
                      value={item.newLabel}
                      onChange={(e) => updateItem(item.key, { newLabel: e.target.value })}
                      className={isRange ? 'col-span-2' : ''}
                    />
                    {isRange ? (
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder={`Jumlah ${unitWord}`}
                        value={item.newSize}
                        onChange={(e) => updateItem(item.key, { newSize: e.target.value })}
                        className="col-span-2"
                      />
                    ) : (
                      <Input
                        placeholder="Arti (opsional)"
                        value={item.newMeaning}
                        onChange={(e) => updateItem(item.key, { newMeaning: e.target.value })}
                      />
                    )}
                  </div>
                )}

                {isRange && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={size ?? undefined}
                        placeholder="dari"
                        value={item.from}
                        onChange={(e) => updateItem(item.key, { from: e.target.value })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={size ?? undefined}
                        placeholder="sampai"
                        value={item.to}
                        onChange={(e) => updateItem(item.key, { to: e.target.value })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.from || item.to
                        ? `${unitWord} ${item.from || '?'}–${item.to || '?'}${size ? ` dari ${size}` : ''}`
                        : `Kosong = seluruh materi${size ? ` (${size} ${unitWord})` : ''}`}
                      {unit?.progress?.nextGap && unit.progress.covered > 0 && !unit.progress.done
                        ? ` · belum: mulai ${unitWord} ${unit.progress.nextGap[0]}`
                        : ''}
                    </p>
                  </div>
                )}

                <MasteryPicker
                  value={item.mastery}
                  onChange={(level) => updateItem(item.key, { mastery: level })}
                />

              </fieldset>
            )
          })}

          {subject.structure !== 'none' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((l) => [...l, emptyItem()])}
            >
              <Plus /> Materi lain
            </Button>
          )}

          {/* Durasi & mood */}
          <div className="space-y-1.5">
            <Label htmlFor="log-duration">Durasi (menit)</Label>
            <div className="flex flex-wrap items-center gap-1">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(String(m))}
                  className={cn(
                    'rounded-md border px-2.5 py-1.5 text-xs',
                    duration === String(m) && 'border-primary bg-accent font-medium',
                  )}
                >
                  {m}
                </button>
              ))}
              <Input
                id="log-duration"
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                className="w-20"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mood anak</Label>
            <div className="flex gap-1">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mood === m}
                  onClick={() => setMood(mood === m ? null : m)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xl',
                    mood === m && 'border-primary bg-accent',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-note">Catatan</Label>
            <Textarea
              id="log-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opsional"
            />
          </div>

          {/* Foto */}
          <div className="space-y-1.5">
            <Label htmlFor="log-photos">Foto</Label>
            {(existingPhotos.length > 0 || photos.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {existingPhotos.map((id) => (
                  <Thumb
                    key={id}
                    src={`/api/files/${id}`}
                    onRemove={() => setRemoved((r) => [...r, id])}
                  />
                ))}
                {photos.map((p, i) => (
                  <Thumb
                    key={`${p.name}-${i}`}
                    file={p}
                    onRemove={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            )}
            <Input
              id="log-photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                setPhotos((list) => [...list, ...files].slice(0, 6))
                e.target.value = ''
              }}
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Thumb({
  src,
  file,
  onRemove,
}: {
  src?: string
  file?: File
  onRemove: () => void
}) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : src), [file, src])
  useEffect(
    () => () => {
      if (file && url) URL.revokeObjectURL(url)
    },
    [file, url],
  )
  return (
    <div className="relative size-16 overflow-hidden rounded-md border">
      <img src={url} alt="" className="size-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Hapus foto"
        className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
