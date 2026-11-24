/**
 * Riwayat log per pelajaran, terbaru dulu, dengan "Muat lagi".
 */
import { MoreVertical } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  type EditableLog,
  LogFormDialog,
  type LogFormSubject,
  type LogFormUnit,
} from '@/components/log-form-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatShortDate, todayIn } from '@/lib/dates'
import { MASTERY_META } from '@/lib/subject-meta'
import { deleteLog, listLogs } from '@/server/logs'

type Page = Awaited<ReturnType<typeof listLogs>>
type LogRow = Page['logs'][number]

export function LogHistory({
  subject,
  units,
  timezone,
  firstPage,
  onChanged,
}: {
  subject: LogFormSubject
  units: LogFormUnit[]
  timezone: string
  firstPage: Page
  onChanged: () => Promise<void>
}) {
  const [extra, setExtra] = useState<LogRow[]>([])
  const [hasMore, setHasMore] = useState(firstPage.hasMore)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<EditableLog | null>(null)
  const [deleting, setDeleting] = useState<LogRow | null>(null)

  // Halaman pertama selalu dari loader (segar setelah invalidate).
  const logs = [...firstPage.logs, ...extra.filter((e) => !firstPage.logs.some((l) => l.id === e.id))]
  const today = todayIn(timezone)

  async function loadMore() {
    setLoading(true)
    try {
      const next = await listLogs({ data: { subjectId: subject.id, offset: logs.length } })
      setExtra((list) => [...list, ...next.logs])
      setHasMore(next.hasMore)
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    setExtra([])
    setHasMore(firstPage.hasMore)
    await onChanged()
  }

  if (logs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Belum ada catatan.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border">
        {logs.map((log) => (
          <li key={log.id} className="space-y-1.5 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {formatShortDate(log.date, today)}
                  {log.mood && <span className="ml-1">{log.mood}</span>}
                </p>
                <ItemsLine log={log} unitLabel={subject.unitLabel} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-mt-1 size-8" aria-label="Menu catatan">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(log)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(log)}>
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-xs text-muted-foreground">
              {[
                log.durationMin ? `${log.durationMin} menit` : null,
                `oleh ${log.loggedByName}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {log.note && <p className="text-sm whitespace-pre-line">{log.note}</p>}
            {log.attachmentIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {log.attachmentIds.map((id) => (
                  <a key={id} href={`/api/files/${id}`} target="_blank" rel="noreferrer">
                    <img
                      src={`/api/files/${id}`}
                      alt="Foto catatan"
                      loading="lazy"
                      className="size-16 rounded-md border object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {hasMore && (
        <Button variant="outline" className="w-full" onClick={loadMore} disabled={loading}>
          {loading ? 'Memuat…' : 'Muat lagi'}
        </Button>
      )}

      {editing && (
        <LogFormDialog
          key={editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          subject={subject}
          units={units}
          timezone={timezone}
          log={editing}
          onSaved={refresh}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Hapus catatan ini?"
        description="Catatan dan fotonya dihapus permanen. Progres dihitung ulang."
        confirmLabel="Hapus"
        onConfirm={async () => {
          if (!deleting) return
          await deleteLog({ data: { logId: deleting.id } })
          toast.success('Catatan dihapus')
          await refresh()
        }}
      />
    </div>
  )
}

function ItemsLine({ log, unitLabel }: { log: LogRow; unitLabel: string | null }) {
  if (log.items.length === 0) return null
  return (
    <ul className="text-sm">
      {log.items.map((i, idx) => (
        <li key={`${i.unitId}-${idx}`}>
          {i.unitLabel}
          {i.rangeFrom !== null && (
            <span className="text-muted-foreground">
              {' '}
              {unitLabel ?? ''} {i.rangeFrom}–{i.rangeTo}
            </span>
          )}
          {i.masteryAfter && (
            <span className="text-muted-foreground"> → {MASTERY_META[i.masteryAfter].label}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
