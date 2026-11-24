import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { AVATARS, ChildAvatar } from '@/components/child-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatAge } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { createChild, updateChild } from '@/server/children'

type ChildValues = {
  id: string
  name: string
  avatar: string | null
  birthDate: string | null
}

export function ChildFormDialog({
  open,
  onOpenChange,
  child,
  today,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kosong = tambah anak baru. */
  child?: ChildValues
  /** Tanggal hari ini (zona waktu keluarga) untuk pratinjau umur. */
  today: string
}) {
  const router = useRouter()
  const [avatar, setAvatar] = useState(child?.avatar ?? AVATARS[0])
  const [name, setName] = useState(child?.name ?? '')
  const [birthDate, setBirthDate] = useState(child?.birthDate ?? '')
  const [pending, setPending] = useState(false)
  const age = formatAge(birthDate || null, today)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = { name, birthDate: birthDate || undefined, avatar }
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
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Pratinjau */}
          <div className="flex flex-col items-center gap-2 py-1">
            <ChildAvatar avatar={avatar} size="lg" />
            <div className="text-center">
              <p className="font-medium">{name.trim() || 'Nama anak'}</p>
              <p className="text-sm text-muted-foreground">{age ?? 'Umur belum diisi'}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  aria-pressed={a === avatar}
                  aria-label={`Pilih avatar ${a}`}
                  className={cn(
                    'flex justify-center rounded-full p-0.5 ring-offset-2 ring-offset-background transition',
                    a === avatar ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100',
                  )}
                >
                  <ChildAvatar avatar={a} size="sm" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="child-name">Nama</Label>
            <Input
              id="child-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="child-birth">Tanggal lahir</Label>
            <Input
              id="child-birth"
              type="date"
              max={today}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Untuk menampilkan umur.</p>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            Simpan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
