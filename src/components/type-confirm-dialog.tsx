import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Konfirmasi untuk aksi yang tidak bisa dibatalkan: tombol baru aktif
 * setelah pengguna mengetik `expected` persis.
 */
export function TypeConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  expected,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  expected: string
  confirmLabel: string
  onConfirm: () => Promise<void>
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const matches = text.trim() === expected

  function change(next: boolean) {
    if (!next) setText('')
    onOpenChange(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!matches) return
    setPending(true)
    try {
      await onConfirm()
      change(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">{description}</div>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="type-confirm">
              Ketik <span className="font-mono font-semibold">{expected}</span> untuk melanjutkan
            </Label>
            <Input
              id="type-confirm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={expected}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => change(false)}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              {pending ? 'Memproses…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
