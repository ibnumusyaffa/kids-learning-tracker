/**
 * Statistik anak: ringkasan, heatmap, menit per pelajaran, peta
 * hafalan, dan level topik.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { ActivityHeatmap, BarList, UnitMap } from '@/components/charts'
import { ChildAvatar } from '@/components/child-avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MASTERY_LEVELS } from '@/db/enums'
import { MASTERY_META } from '@/lib/subject-meta'
import { getChildStats } from '@/server/stats'

export const Route = createFileRoute('/_app/children/$childId/stats')({
  loader: ({ params }) => getChildStats({ data: { childId: params.childId } }),
  component: StatsPage,
})

function StatsPage() {
  const s = Route.useLoaderData()
  const nothing = s.heatmap.every((d) => d.sessions === 0)

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/children/$childId"
          params={{ childId: s.child.id }}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          <ChildAvatar avatar={s.child.avatar} size="xs" /> {s.child.name}
        </Link>
        <h1 className="text-xl font-semibold">Statistik</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Streak sekarang" value={s.streak.current} unit="hari" />
        <Stat label="Streak terpanjang" value={s.streak.longest} unit="hari" />
        <Stat label="Hari aktif (30 hari)" value={s.totals.activeDays30} unit="hari" />
        <Stat label="Belajar minggu ini" value={s.totals.minutesWeek} unit="menit" />
      </div>


      <Section title="Aktivitas">
        {nothing ? (
          <Empty>Belum ada catatan belajar.</Empty>
        ) : (
          <ActivityHeatmap days={s.heatmap} today={s.today} />
        )}
      </Section>

      {s.minutes.length > 0 && (
        <Section title="Menit belajar per pelajaran">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Minggu ini</p>
              <BarList
                unit="mnt"
                rows={s.minutes.map((m) => ({ key: m.subjectId, label: m.name, value: m.week }))}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">30 hari terakhir</p>
              <BarList
                unit="mnt"
                rows={s.minutes.map((m) => ({ key: m.subjectId, label: m.name, value: m.last30 }))}
              />
            </div>
          </div>
        </Section>
      )}

      {s.rangeMaps
        .filter((r) => r.units.length > 0)
        .map((r) => {
          const done = r.units.filter((u) => u.done).length
          const covered = r.units.reduce((n, u) => n + u.covered, 0)
          const size = r.units.reduce((n, u) => n + u.size, 0)
          return (
            <Section key={r.subjectId} title={`Peta ${r.name}`}>
              <p className="mb-3 text-sm text-muted-foreground">
                {done}/{r.units.length} selesai · {covered}/{size} {r.unitLabel ?? ''}
              </p>
              <UnitMap units={r.units} unitLabel={r.unitLabel} />
            </Section>
          )
        })}

      {s.topics
        .filter((t) => t.total > 0)
        .map((t) => (
          <Section key={t.subjectId} title={t.name}>
            <div className="mb-4 grid grid-cols-4 gap-2 text-center">
              {[...MASTERY_LEVELS].reverse().map((l) => (
                <div key={l}>
                  <p className="text-xl font-semibold tabular-nums">{t.levels[l]}</p>
                  <p className="text-xs text-muted-foreground">{MASTERY_META[l].label}</p>
                </div>
              ))}
            </div>
          </Section>
        ))}

    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {value.toLocaleString('id-ID')}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
