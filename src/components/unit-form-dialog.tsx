import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Structure } from '@/db/enums'
import { createUnit, updateUnit } from '@/server/units'

const NO_PARENT = '__root__'

export type UnitFormValues = {
  id: string
  label: string
  size: number | null
  parentId: string | null
  meaning: string | null
  tags: string[]
}

export function UnitFormDialog({
  open,
  onOpenChange,
  subjectId,
  structure,
  unitLabel,
  openEnded,
  parentOptions,
  unit,
  defaultParentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectId: string
  structure: Exclude<Structure, 'none'>
  unitLabel: string | null
  openEnded: boolean
  /** Topik yang boleh jadi induk (checklist). */
  parentOptions: { id: string; label: string }[]
  /** Kosong = tambah materi baru. */
  unit?: UnitFormValues
  defaultParentId?: string | null
}) {
  const router = useRouter()
  const [parentId, setParentId] = useState<string | null>(
    unit?.parentId ?? defaultParentId ?? null,
  )
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const sizeRaw = String(form.get('size') ?? '')
    const values = {
      label: String(form.get('label')),
      size: sizeRaw ? Number(sizeRaw) : null,
      parentId: structure === 'checklist' ? parentId : null,
      meaning: String(form.get('meaning') ?? '') || null,
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }
    setPending(true)
    try {
      if (unit) {
        await updateUnit({ data: { ...values, unitId: unit.id } })
      } else {
        await createUnit({ data: { ...values, subjectId } })
      }
      onOpenChange(false)
      await router.invalidate()
    } catch {
      toast.error('Gagal menyimpan materi')
    } finally {
      setPending(false)
    }
  }

  const options = parentOptions.filter((p) => p.id !== unit?.id)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setParentId(unit?.parentId ?? defaultParentId ?? null)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{unit ? 'Edit materi' : 'Tambah materi'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="unit-label">
              {openEnded && structure === 'checklist' ? 'Kata / item' : 'Nama'}
            </Label>
            <Input
              id="unit-label"
              name="label"
              required
              defaultValue={unit?.label}
              placeholder={structure === 'range' ? 'Iqra 2' : 'Perkalian'}
            />
          </div>

          {structure === 'range' && (
            <div className="space-y-1.5">
              <Label htmlFor="unit-size">
                Jumlah {unitLabel ?? 'bagian'}
              </Label>
              <Input
                id="unit-size"
                name="size"
                type="number"
                inputMode="numeric"
                min={1}
                required
                defaultValue={unit?.size ?? ''}
              />
            </div>
          )}

          {structure === 'checklist' && options.length > 0 && (
            <div className="space-y-1.5">
              <Label>Induk topik</Label>
              <Select
                value={parentId ?? NO_PARENT}
                onValueChange={(v) => setParentId(v === NO_PARENT ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>— Topik utama —</SelectItem>
                  {options.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {structure === 'checklist' && openEnded && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="unit-meaning">Arti</Label>
                <Input
                  id="unit-meaning"
                  name="meaning"
                  defaultValue={unit?.meaning ?? ''}
                  placeholder="sendok"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit-tags">Tag</Label>
                <Input
                  id="unit-tags"
                  name="tags"
                  defaultValue={unit?.tags.join(', ') ?? ''}
                  placeholder="rumah, dapur"
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            Simpan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
