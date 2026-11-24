import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch'
import {
  STRUCTURES,
  type Structure,
  SUGGEST_ORDERS,
  type SuggestOrder,
} from '@/db/enums'
import {
  STRUCTURE_META,
  SUGGEST_ORDER_META,
} from '@/lib/subject-meta'
import { cn } from '@/lib/utils'
import { createSubject, updateSubject } from '@/server/subjects'

type Category = { id: string; name: string }
type Preset = {
  id: string
  code: string
  name: string
  structure: Structure
  unitLabel: string | null
  unitCount: number
}

const NO_CATEGORY = '__none__'

// ---------------------------------------------------------------------------
// Field bersama
// ---------------------------------------------------------------------------

export type SubjectFieldValues = {
  name: string
  structure: Structure
  unitLabel: string
  openEnded: boolean
  suggestOrder: SuggestOrder
  categoryId: string | null
}

function SubjectFields({
  values,
  onChange,
  categories,
  structureLocked,
}: {
  values: SubjectFieldValues
  onChange: (v: SubjectFieldValues) => void
  categories: Category[]
  structureLocked?: boolean
}) {
  const set = <K extends keyof SubjectFieldValues>(
    key: K,
    value: SubjectFieldValues[K],
  ) => onChange({ ...values, [key]: value })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="subject-name">Nama pelajaran</Label>
        <Input
          id="subject-name"
          required
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Matematika"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Bentuk materi</Label>
        <div className="grid gap-2">
          {STRUCTURES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={structureLocked && s !== values.structure}
              onClick={() =>
                onChange({ ...values, structure: s })
              }
              className={cn(
                'rounded-md border p-3 text-left disabled:opacity-40',
                values.structure === s && 'border-primary bg-accent',
              )}
            >
              <p className="font-medium">
                {STRUCTURE_META[s].emoji} {STRUCTURE_META[s].label}
              </p>
              <p className="text-xs text-muted-foreground">
                {STRUCTURE_META[s].description}
              </p>
            </button>
          ))}
        </div>
        {structureLocked && (
          <p className="text-xs text-muted-foreground">
            Bentuk materi terkunci karena pelajaran ini sudah punya log.
          </p>
        )}
      </div>

      {values.structure === 'range' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="subject-unit-label">Satuan</Label>
            <Input
              id="subject-unit-label"
              value={values.unitLabel}
              onChange={(e) => set('unitLabel', e.target.value)}
              placeholder="halaman"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Saran materi berikutnya</Label>
            <Select
              value={values.suggestOrder}
              onValueChange={(v) => set('suggestOrder', v as SuggestOrder)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUGGEST_ORDERS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {SUGGEST_ORDER_META[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {values.structure !== 'none' && (
        <label className="flex items-center justify-between gap-3 rounded-md border p-3">
          <span>
            <span className="block text-sm font-medium">
              Materi bertambah terus
            </span>
            <span className="block text-xs text-muted-foreground">
              Untuk vocab, doa, atau buku: materi baru bisa ditambah saat
              mencatat.
            </span>
          </span>
          <Switch
            checked={values.openEnded}
            onCheckedChange={(v) => set('openEnded', v)}
          />
        </label>
      )}

      <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select
            value={values.categoryId ?? NO_CATEGORY}
            onValueChange={(v) =>
              set('categoryId', v === NO_CATEGORY ? null : v)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Tanpa kategori</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>
    </div>
  )
}

const emptyValues = (): SubjectFieldValues => ({
  name: '',
  structure: 'checklist',
  unitLabel: '',
  openEnded: false,
  suggestOrder: 'asc',
  categoryId: null,
})

// ---------------------------------------------------------------------------
// Tambah pelajaran
// ---------------------------------------------------------------------------

export function AddSubjectDialog({
  open,
  onOpenChange,
  childId,
  presets,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  childId: string
  presets: Preset[]
  categories: Category[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<'choose' | 'custom'>('choose')
  const [values, setValues] = useState(emptyValues)
  const [pending, setPending] = useState(false)

  function reset(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setStep('choose')
      setValues(emptyValues())
    }
  }

  async function run(fn: () => Promise<{ id: string }>) {
    setPending(true)
    try {
      const { id } = await fn()
      reset(false)
      toast.success('Pelajaran ditambahkan')
      await router.navigate({
        to: '/children/$childId/subjects/$subjectId',
        params: { childId, subjectId: id },
      })
    } catch {
      toast.error('Gagal menambahkan pelajaran')
    } finally {
      setPending(false)
    }
  }

  function addPreset(presetId: string) {
    return run(() =>
      createSubject({ data: { source: 'preset', childId, presetId } }),
    )
  }

  function addCustom(e: React.FormEvent) {
    e.preventDefault()
    return run(() =>
      createSubject({
        data: {
          source: 'custom',
          childId,
          name: values.name,
          structure: values.structure,
          unitLabel: values.unitLabel || null,
          openEnded: values.openEnded,
          suggestOrder: values.suggestOrder,
          categoryId: values.categoryId,
        },
      }),
    )
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah pelajaran</DialogTitle>
          <DialogDescription>
            {step === 'choose'
              ? 'Pakai template yang sudah ada, atau buat sendiri.'
              : 'Atur pelajaran baru.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' ? (
          <div className="space-y-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => addPreset(p.id)}
                className="w-full rounded-md border p-3 text-left hover:bg-accent"
              >
                <p className="font-medium">
                  {STRUCTURE_META[p.structure].emoji} {p.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.unitCount} materi
                  {p.unitLabel ? ` · per ${p.unitLabel}` : ''}
                </p>
              </button>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep('custom')}
            >
              Buat sendiri
            </Button>
          </div>
        ) : (
          <form onSubmit={addCustom} className="space-y-4">
            <SubjectFields
              values={values}
              onChange={setValues}
              categories={categories}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('choose')}
              >
                Kembali
              </Button>
              <Button type="submit" className="flex-1" disabled={pending}>
                Simpan
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Pengaturan pelajaran
// ---------------------------------------------------------------------------

export function SubjectSettingsDialog({
  open,
  onOpenChange,
  subjectId,
  initial,
  categories,
  structureLocked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectId: string
  initial: SubjectFieldValues
  categories: Category[]
  structureLocked: boolean
}) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await updateSubject({
        data: {
          subjectId,
          name: values.name,
          structure: values.structure,
          unitLabel: values.unitLabel || null,
          openEnded: values.openEnded,
          suggestOrder: values.suggestOrder,
          categoryId: values.categoryId,
        },
      })
      onOpenChange(false)
      toast.success('Pelajaran diperbarui')
      await router.invalidate()
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes('STRUCTURE_LOCKED')
          ? 'Bentuk materi tidak bisa diubah karena sudah ada log'
          : 'Gagal menyimpan pelajaran',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValues(initial)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pengaturan pelajaran</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <SubjectFields
            values={values}
            onChange={setValues}
            categories={categories}
            structureLocked={structureLocked}
          />
          <Button type="submit" className="w-full" disabled={pending}>
            Simpan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
