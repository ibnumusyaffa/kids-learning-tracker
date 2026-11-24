/**
 * Layar "Hari Ini": pintu masuk harian orang tua. Lihat docs.md bagian 7.2.
 *
 * Isi per anak: kebiasaan harian (centang), saran lanjut, dan perlu diulang.
 */
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, RotateCcw, Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { ChildAvatar } from '@/components/child-avatar'
import { type LaunchRequest, SubjectLogLauncher } from '@/components/subject-log-launcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatAge, formatLocalDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { createLog } from '@/server/logs'
import { type TodayReview, type TodaySuggestion, getToday } from '@/server/today'

export const Route = createFileRoute('/_app/today')({
  loader: () => getToday(),
  component: TodayPage,
})

function TodayPage() {
  const { today, children } = Route.useLoaderData()
  const { viewer } = Route.useRouteContext()
  const router = useRouter()
  const [launch, setLaunch] = useState<LaunchRequest | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(() => router.invalidate(), [router])
  const closeLaunch = useCallback(() => setLaunch(null), [])

  async function checkHabit(subjectId: string) {
    setBusy(subjectId)
    try {
      await createLog({ data: { subjectId, date: today, items: [] } })
      toast.success('Tercatat ✓')
      await refresh()
    } catch {
      toast.error('Gagal menyimpan')
    } finally {
      setBusy(null)
    }
  }

  if (children.length === 0) {
    return (
      <div className="space-y-4">
        <Header today={today} />
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Tambahkan profil anak untuk mulai mencatat.
          </p>
          <Button asChild>
            <Link to="/children">Tambah anak</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Header today={today} />

      {children.map((c) => (
        <Card key={c.child.id}>
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="flex flex-1 items-center gap-2">
                <ChildAvatar avatar={c.child.avatar} size="sm" />
                <Link to="/children/$childId" params={{ childId: c.child.id }} className="min-w-0">
                  <span className="block truncate">{c.child.name}</span>
                  {c.child.birthDate && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatAge(c.child.birthDate, today, true)}
                    </span>
                  )}
                </Link>
              </CardTitle>
              {c.total > 0 && (
                <span className="text-sm text-muted-foreground">
                  {c.done}/{c.total} ✓
                </span>
              )}
            </div>
            {c.total > 0 && <Progress value={(c.done / c.total) * 100} className="h-1.5" />}
          </CardHeader>

          <CardContent className="space-y-3">
            {c.subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada pelajaran.{' '}
                <Link
                  to="/children/$childId"
                  params={{ childId: c.child.id }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Tambah pelajaran
                </Link>
              </p>
            ) : (
              c.total === 0 &&
              c.suggestions.length === 0 && (
                <p className="text-sm text-muted-foreground">Tidak ada saran untuk hari ini. 🎉</p>
              )
            )}

            {c.habits.length > 0 && (
              <ul className="space-y-1">
                {c.habits.map((h) => (
                  <CheckRow
                    key={h.subject.id}
                    done={h.done}
                    busy={busy === h.subject.id}
                    title={h.subject.name}
                    meta={['Kebiasaan harian']}
                    onToggle={() =>
                      h.done
                        ? router.navigate({
                            to: '/children/$childId/subjects/$subjectId',
                            params: { childId: c.child.id, subjectId: h.subject.id },
                          })
                        : checkHabit(h.subject.id)
                    }
                  />
                ))}
              </ul>
            )}

            {c.suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Sparkles className="size-3.5" /> Saran
                </p>
                <ul className="space-y-1">
                  {c.suggestions.map((s) => (
                    <SuggestionRow
                      key={`${s.kind}-${s.subject.id}`}
                      item={s}
                      onLog={() =>
                        setLaunch({
                          subjectId: s.subject.id,
                          prefill: s.kind === 'review' ? reviewPrefill(s) : suggestionPrefill(s),
                        })
                      }
                    />
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <SubjectLogLauncher
        request={launch}
        onClose={closeLaunch}
        timezone={viewer.family.timezone}
        onSaved={refresh}
      />
    </div>
  )
}

function Header({ today }: { today: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">Hari Ini</h1>
      <p className="text-sm text-muted-foreground">{formatLocalDate(today)}</p>
    </div>
  )
}

function CheckRow({
  done,
  busy,
  title,
  meta,
  onToggle,
}: {
  done: boolean
  busy: boolean
  title: string
  meta: (string | null | undefined)[]
  onToggle: () => void
}) {
  const metaText = meta.filter(Boolean).join(' · ')
  return (
    <li>
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        aria-pressed={done}
        className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-accent disabled:opacity-60"
      >
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
            done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
          )}
        >
          {done && <Check className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block', done && 'text-muted-foreground line-through')}>{title}</span>
          {metaText && <span className="block text-xs text-muted-foreground">{metaText}</span>}
        </span>
      </button>
    </li>
  )
}

function SuggestionRow({
  item,
  onLog,
}: {
  item: TodaySuggestion | TodayReview
  onLog: () => void
}) {
  const unit = item.subject.unitLabel ?? ''
  let title: string
  let detail: string
  if (item.kind === 'suggestion') {
    title =
      item.reason === 'continue'
        ? `Lanjut ${item.unitLabel} ${unit} ${item.from}–${item.to}`
        : `Mulai ${item.unitLabel}`
    detail = item.subject.name
  } else {
    title = `Perlu diulang: ${item.units.map((u) => u.label).join(', ')}`
    detail = [
      item.subject.name,
      item.units
        .map((u) =>
          u.reason === 'weak'
            ? `${u.label}: level masih rendah (${u.days} hari lalu)`
            : `${u.label}: ${u.days} hari tidak diulang`,
        )
        .join('; '),
    ].join(' · ')
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-dashed px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <Button size="sm" variant="outline" onClick={onLog}>
        {item.kind === 'review' ? <RotateCcw /> : null}
        {item.kind === 'review' ? 'Ulang' : 'Catat'}
      </Button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Isian awal form catat
// ---------------------------------------------------------------------------

function suggestionPrefill(s: TodaySuggestion) {
  return { items: [{ unitId: s.unitId, from: s.from, to: s.to }] }
}

function reviewPrefill(r: TodayReview) {
  return { items: r.units.map((u) => ({ unitId: u.unitId, from: null, to: null })) }
}
