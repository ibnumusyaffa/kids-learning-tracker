import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { BarChart3, ChevronRight, MoreVertical, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChildFormDialog } from '@/components/child-form-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PaceLine } from '@/components/pace-line'
import { AddSubjectDialog } from '@/components/subject-form-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { STRUCTURE_META } from '@/lib/subject-meta'
import { archiveChild } from '@/server/children'
import {
  type SubjectSummary,
  getChildDetail,
  getSubjectFormOptions,
} from '@/server/subjects'

export const Route = createFileRoute('/_app/children/$childId/')({
  loader: async ({ params }) => {
    const [detail, options] = await Promise.all([
      getChildDetail({ data: { childId: params.childId } }),
      getSubjectFormOptions(),
    ])
    return { ...detail, options }
  },
  component: ChildPage,
})

function ChildPage() {
  const { child, subjects, options } = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [adding, setAdding] = useState(false)

  // Kelompokkan per kategori, urutan mengikuti kategori keluarga.
  const groups = [
    ...options.categories.map((c) => ({
      key: c.id,
      name: c.name,
      items: subjects.filter((s) => s.categoryId === c.id),
    })),
    {
      key: 'none',
      name: 'Lainnya',
      items: subjects.filter(
        (s) =>
          !s.categoryId ||
          !options.categories.some((c) => c.id === s.categoryId),
      ),
    },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{child.avatar ?? '🙂'}</span>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{child.name}</h1>
          {child.grade && (
            <p className="text-sm text-muted-foreground">{child.grade}</p>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/children/$childId/stats" params={{ childId: child.id }}>
            <BarChart3 /> Statistik
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu anak">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              Edit profil
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => setArchiving(true)}
            >
              Arsipkan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Pelajaran</h2>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Tambah
        </Button>
      </div>

      {subjects.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada pelajaran. Tambahkan dari template (misal Hafalan Juz 30)
          atau buat sendiri.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.name}
            </h3>
            {group.items.map((s) => (
              <Link
                key={s.id}
                to="/children/$childId/subjects/$subjectId"
                params={{ childId: child.id, subjectId: s.id }}
              >
                <Card className="mb-2 py-4 transition-colors hover:bg-accent">
                  <CardContent className="flex items-center gap-3">
                    <span className="text-xl">
                      {STRUCTURE_META[s.structure].emoji}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-medium">{s.name}</p>
                      <SummaryLine summary={s.summary} unitLabel={s.unitLabel} />
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>
        ))
      )}

      <ChildFormDialog open={editing} onOpenChange={setEditing} child={child} />
      <AddSubjectDialog
        open={adding}
        onOpenChange={setAdding}
        childId={child.id}
        presets={options.presets}
        categories={options.categories}
      />
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Arsipkan ${child.name}?`}
        description="Profil disembunyikan dari aplikasi. Data dan log lama tetap tersimpan."
        confirmLabel="Arsipkan"
        onConfirm={async () => {
          await archiveChild({ data: { childId: child.id } })
          toast.success('Profil anak diarsipkan')
          await router.navigate({ to: '/children' })
        }}
      />
    </div>
  )
}

function SummaryLine({
  summary,
  unitLabel,
}: {
  summary: SubjectSummary
  unitLabel: string | null
}) {
  if (summary.kind === 'none') {
    return <p className="text-sm text-muted-foreground">Kebiasaan harian</p>
  }
  if (summary.total === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada materi</p>
  }
  if (summary.kind === 'range') {
    const percent = summary.size
      ? Math.round((summary.covered / summary.size) * 100)
      : 0
    return (
      <div className="space-y-1">
        <Progress value={percent} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {summary.done}/{summary.total} selesai · {summary.covered}/
          {summary.size} {unitLabel ?? ''}
        </p>
        <PaceLine pace={summary.pace} unitLabel={unitLabel} />
      </div>
    )
  }
  const { byLevel, total } = summary
  return (
    <div className="space-y-1">
      <Progress
        value={Math.round(((byLevel.mahir + byLevel.bisa) / total) * 100)}
        className="h-1.5"
      />
      <p className="text-xs text-muted-foreground">
        {byLevel.mahir} mahir · {byLevel.bisa} bisa · {byLevel.kenal} kenal ·{' '}
        {byLevel.belum} belum
      </p>
    </div>
  )
}
