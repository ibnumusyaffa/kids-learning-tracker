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
import { createChild, updateChild } from '@/server/children'

const AVATARS = ['🦋', '🦁', '🐳', '🦊', '🐼', '🐣', '🦄', '🐢']

type ChildValues = {
  id: string
  name: string
  grade: string | null
  avatar: string | null
  birthDate: string | null
}

export function ChildFormDialog({
  open,
  onOpenChange,
  child,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kosong = tambah anak baru. */
  child?: ChildValues
}) {
  const router = useRouter()
  const [avatar, setAvatar] = useState(child?.avatar ?? AVATARS[0])
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const values = {
      name: String(form.get('name')),
      grade: String(form.get('grade') ?? ''),
      birthDate: String(form.get('birthDate') ?? '') || undefined,
      avatar,
    }
    setPending(true)
    try {
      if (child) {
        await updateChild({ data: { ...values, childId: child.id } })
        toast.success('Profil anak diperbarui')
      } else {
        await createChild({ data: values })
        toast.success('Profil anak ditambahkan')
      }
      onOpenChange(false)
      await router.invalidate()
    } catch {
      toast.error('Gagal menyimpan profil anak')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{child ? 'Edit profil anak' : 'Tambah anak'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  aria-pressed={a === avatar}
                  className={`rounded-md border p-1.5 text-2xl ${a === avatar ? 'border-primary bg-accent' : ''}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="child-name">Nama</Label>
            <Input
              id="child-name"
              name="name"
              required
              defaultValue={child?.name}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="child-grade">Kelas</Label>
              <Input
                id="child-grade"
                name="grade"
                placeholder="SD 2"
                defaultValue={child?.grade ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="child-birth">Tanggal lahir</Label>
              <Input
                id="child-birth"
                name="birthDate"
                type="date"
                defaultValue={child?.birthDate ?? ''}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            Simpan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
