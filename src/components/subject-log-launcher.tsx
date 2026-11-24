/**
 * Membuka form catat untuk pelajaran mana pun (dipakai layar Hari Ini).
 * Data materi + progres diambil saat dibuka, bukan di loader halaman.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LogFormDialog, type LogPrefill } from '@/components/log-form-dialog'
import { getSubjectDetail } from '@/server/subjects'

export type LaunchRequest = {
  subjectId: string
  prefill?: LogPrefill
}

type Detail = Awaited<ReturnType<typeof getSubjectDetail>>

export function SubjectLogLauncher({
  request,
  onClose,
  timezone,
  onSaved,
}: {
  request: LaunchRequest | null
  onClose: () => void
  timezone: string
  onSaved: () => Promise<void> | void
}) {
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    setDetail(null)
    if (!request) return
    let cancelled = false
    getSubjectDetail({ data: { subjectId: request.subjectId } })
      .then((d) => !cancelled && setDetail(d))
      .catch(() => {
        if (cancelled) return
        toast.error('Gagal memuat pelajaran')
        onClose()
      })
    return () => {
      cancelled = true
    }
  }, [request, onClose])

  if (!request || !detail) return null
  return (
    <LogFormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      subject={detail.subject}
      units={detail.units}
      timezone={timezone}
      prefill={request.prefill}
      lastLog={detail.lastLog}
      onSaved={onSaved}
    />
  )
}
