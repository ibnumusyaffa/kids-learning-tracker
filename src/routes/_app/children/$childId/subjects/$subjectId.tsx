import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  Check,
  ChevronLeft,
  MoreVertical,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChildAvatar } from '@/components/child-avatar'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SortableUnitList } from '@/components/sortable-unit-list'
import { TypeConfirmDialog } from '@/components/type-confirm-dialog'
import { PaceLine } from '@/components/pace-line'
import { LogFormDialog } from '@/components/log-form-dialog'
import { LogHistory } from '@/components/log-history'
import { MasteryPicker } from '@/components/mastery'
import { SubjectSettingsDialog } from '@/components/subject-form-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { UnitFormDialog } from '@/components/unit-form-dialog'
import type { MasteryLevel } from '@/db/enums'
import { STRUCTURE_META } from '@/lib/subject-meta'
import { listLogs } from '@/server/logs'
import {
  RESET_CONFIRM_TEXT,
  archiveSubject,
  getSubjectDetail,
  getSubjectFormOptions,
  resetSubjectProgress,
} from '@/server/subjects'
import {
  archiveUnit,
  setUnitCompleted,
  setUnitMastery,
} from '@/server/units'

export const Route = createFileRoute(
  '/_app/children/$childId/subjects/$subjectId',
)({
  loader: async ({ params }) => {
    const [detail, options, logs] = await Promise.all([
      getSubjectDetail({ data: { subjectId: params.subjectId } }),
      getSubjectFormOptions(),
      listLogs({ data: { subjectId: params.subjectId, offset: 0 } }),
    ])
    return { ...detail, categories: options.categories, logs }
  },
  component: SubjectPage,
})

type Data = Awaited<ReturnType<typeof getSubjectDetail>>
type Unit = Data['units'][number]

function SubjectPage() {
  const { child, subject, units, hasLogs, logCount, lastLog, pace, categories, logs } =
    Route.useLoaderData()
  const { viewer } = Route.useRouteContext()
  const router = useRouter()
  const [logOpen, setLogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addParentId, setAddParentId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Unit | null>(null)
  const [editing, setEditing] = useState<Unit | null>(null)

  const meta = STRUCTURE_META[subject.structure]
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Unit[]>()
    for (const u of units) {
      const list = map.get(u.parentId) ?? []
      list.push(u)
      map.set(u.parentId, list)
    }
    return map
  }, [units])

  const parentOptions = units
    .filter((u) => !u.parentId)
    .map((u) => ({ id: u.id, label: u.label }))

  function openAdd(parentId: string | null = null) {
    setAddParentId(parentId)
    setAddOpen(true)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/children/$childId"
          params={{ childId: child.id }}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          <ChildAvatar avatar={child.avatar} size="xs" /> {child.name}
        </Link>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{subject.name}</h1>
            <p className="text-sm text-muted-foreground">
              {meta.emoji} {meta.label}
              {subject.openEnded && ' · materi bertambah'}
            </p>
          </div>
          <Button onClick={() => setLogOpen(true)}>
            <NotebookPen /> Catat
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu pelajaran">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                Pengaturan
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setResetOpen(true)}
              >
                Reset progres
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setArchiveOpen(true)}
              >
                Arsipkan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {subject.structure === 'none' ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Kebiasaan harian tidak punya daftar materi. Cukup catat setiap kali
          dilakukan.
        </p>
      ) : (
        <>
          <Overview subject={subject} units={units} pace={pace} />

          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Materi ({units.length})</h2>
              {units.length > 1 && (
                <p className="text-xs text-muted-foreground">Geser ⠿ untuk mengubah urutan</p>
              )}
            </div>
            <Button size="sm" onClick={() => openAdd()}>
              <Plus /> Tambah
            </Button>
          </div>

          {units.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada materi.
            </p>
          ) : (
            <SortableUnitList
              subjectId={subject.id}
              units={units}
              unitLabel={subject.unitLabel}
              onSelect={(u) => setSelected(units.find((x) => x.id === u.id) ?? null)}
            />
          )}
        </>
      )}

      {subject.structure !== 'none' && (
        <>
          <UnitFormDialog
            key={`add-${addParentId ?? 'root'}-${addOpen}`}
            open={addOpen}
            onOpenChange={setAddOpen}
            subjectId={subject.id}
            structure={subject.structure}
            unitLabel={subject.unitLabel}
            openEnded={subject.openEnded}
            parentOptions={parentOptions}
            defaultParentId={addParentId}
          />
          {editing && (
            <UnitFormDialog
              key={`edit-${editing.id}`}
              open
              onOpenChange={(o) => !o && setEditing(null)}
              subjectId={subject.id}
              structure={subject.structure}
              unitLabel={subject.unitLabel}
              openEnded={subject.openEnded}
              parentOptions={parentOptions}
              unit={editing}
            />
          )}
          {selected && (
            <UnitActionsDialog
              unit={selected}
              structure={subject.structure}
              unitLabel={subject.unitLabel}
              canHaveChildren={
                subject.structure === 'checklist' && !selected.parentId
              }
              isParent={(childrenOf.get(selected.id) ?? []).length > 0}
              onClose={() => setSelected(null)}
              onEdit={() => {
                setEditing(selected)
                setSelected(null)
              }}
              onAddChild={() => {
                const id = selected.id
                setSelected(null)
                openAdd(id)
              }}
            />
          )}
        </>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Riwayat</h2>
        <LogHistory
          subject={subject}
          units={units}
          timezone={viewer.family.timezone}
          firstPage={logs}
          onChanged={() => router.invalidate()}
        />
      </section>

      <LogFormDialog
        key={`new-log-${logOpen}`}
        open={logOpen}
        onOpenChange={setLogOpen}
        subject={subject}
        units={units}
        timezone={viewer.family.timezone}
        lastLog={lastLog}
        onSaved={() => router.invalidate()}
      />

      <SubjectSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        subjectId={subject.id}
        categories={categories}
        structureLocked={hasLogs}
        initial={{
          name: subject.name,
          structure: subject.structure,
          unitLabel: subject.unitLabel ?? '',
          openEnded: subject.openEnded,
          suggestOrder: subject.suggestOrder,
          categoryId: subject.categoryId,
        }}
      />
      <TypeConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={`Reset progres ${subject.name}?`}
        expected={RESET_CONFIRM_TEXT}
        confirmLabel="Reset progres"
        description={
          <>
            <p>
              <strong>{logCount} catatan</strong> beserta fotonya akan dihapus permanen, dan level
              serta tanda selesai semua materi dikosongkan. Tindakan ini tidak bisa dibatalkan.
            </p>
            <p>Daftar materi ({units.length}) tetap ada.</p>
          </>
        }
        onConfirm={async () => {
          try {
            const res = await resetSubjectProgress({
              data: { subjectId: subject.id, confirm: RESET_CONFIRM_TEXT },
            })
            toast.success(`Progres direset · ${res.deletedLogs} catatan dihapus`)
            await router.invalidate()
          } catch {
            toast.error('Gagal mereset progres')
          }
        }}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Arsipkan ${subject.name}?`}
        description="Pelajaran disembunyikan. Materi dan log lama tetap tersimpan."
        confirmLabel="Arsipkan"
        onConfirm={async () => {
          await archiveSubject({ data: { subjectId: subject.id } })
          toast.success('Pelajaran diarsipkan')
          await router.navigate({
            to: '/children/$childId',
            params: { childId: child.id },
          })
        }}
      />
    </div>
  )
}

function Overview({
  subject,
  units,
  pace,
}: {
  subject: Data['subject']
  units: Unit[]
  pace: Data['pace']
}) {
  if (units.length === 0) return null

  if (subject.structure === 'range') {
    const done = units.filter((u) => u.progress?.done).length
    const covered = units.reduce((n, u) => n + (u.progress?.covered ?? 0), 0)
    const size = units.reduce((n, u) => n + (u.size ?? 0), 0)
    const percent = size ? Math.round((covered / size) * 100) : 0
    return (
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-semibold">
            {done}
            <span className="text-base font-normal text-muted-foreground">
              /{units.length} selesai
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {covered}/{size} {subject.unitLabel ?? ''} · {percent}%
          </p>
        </div>
        <Progress value={percent} />
        <PaceLine pace={pace} unitLabel={subject.unitLabel} className="text-sm text-muted-foreground" />
      </div>
    )
  }

  const parentIds = new Set(units.map((u) => u.parentId).filter(Boolean))
  const leaves = units.filter((u) => !parentIds.has(u.id))
  const count = (l: MasteryLevel) =>
    leaves.filter((u) => (u.mastery ?? 'belum') === l).length
  return (
    <div className="grid grid-cols-4 gap-2 rounded-lg border p-4 text-center">
      {(['mahir', 'bisa', 'kenal', 'belum'] as const).map((l) => (
        <div key={l}>
          <p className="text-2xl font-semibold">{count(l)}</p>
          <p className="text-xs capitalize text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
  )
}

function UnitActionsDialog({
  unit,
  structure,
  unitLabel,
  canHaveChildren,
  isParent,
  onClose,
  onEdit,
  onAddChild,
}: {
  unit: Unit
  structure: 'range' | 'checklist'
  unitLabel: string | null
  canHaveChildren: boolean
  /** Topik induk: level diisi di sub-topiknya, bukan di sini. */
  isParent: boolean
  onClose: () => void
  onEdit: () => void
  onAddChild: () => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [mastery, setMastery] = useState(unit.mastery)
  const [confirmArchive, setConfirmArchive] = useState(false)

  async function act(fn: () => Promise<unknown>, close = false) {
    setPending(true)
    try {
      await fn()
      await router.invalidate()
      if (close) onClose()
    } catch {
      toast.error('Gagal menyimpan')
    } finally {
      setPending(false)
    }
  }

  const p = unit.progress

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{unit.label}</DialogTitle>
            {p && (
              <DialogDescription>
                {p.covered}/{p.size} {unitLabel ?? ''} tersentuh
                {p.nextGap && !p.done
                  ? ` · lanjut ${unitLabel ?? ''} ${p.nextGap[0]}`
                  : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          {structure === 'checklist' && isParent && (
            <p className="text-sm text-muted-foreground">
              Topik induk. Level dan catatan diisi di sub-topiknya.
            </p>
          )}
          {structure === 'checklist' && !isParent && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Level</p>
              <MasteryPicker
                value={mastery}
                disabled={pending}
                onChange={(level) => {
                  setMastery(level)
                  act(() =>
                    setUnitMastery({ data: { unitId: unit.id, mastery: level } }),
                  )
                }}
              />
            </div>
          )}

          {structure === 'range' && (
            <Button
              variant={unit.completedAt ? 'outline' : 'default'}
              disabled={pending}
              onClick={() =>
                act(
                  () =>
                    setUnitCompleted({
                      data: { unitId: unit.id, completed: !unit.completedAt },
                    }),
                  true,
                )
              }
            >
              <Check />
              {unit.completedAt ? 'Batalkan tanda selesai' : 'Tandai selesai'}
            </Button>
          )}

          <div className={canHaveChildren ? 'grid grid-cols-2 gap-2' : 'grid'}>
            <Button variant="outline" onClick={onEdit} disabled={pending}>
              <Pencil /> Edit
            </Button>
            {canHaveChildren && (
              <Button variant="outline" onClick={onAddChild} disabled={pending}>
                <Plus /> Sub-topik
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={() => setConfirmArchive(true)}
          >
            <Trash2 /> Arsipkan materi
          </Button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Arsipkan ${unit.label}?`}
        description="Sub-topik ikut diarsipkan. Log lama tetap tersimpan."
        confirmLabel="Arsipkan"
        onConfirm={() =>
          act(() => archiveUnit({ data: { unitId: unit.id } }), true)
        }
      />
    </>
  )
}
