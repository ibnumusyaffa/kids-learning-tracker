/**
 * Daftar materi dengan urutan yang bisa diubah lewat drag & drop.
 *
 * - Geser lewat pegangan (⠿) supaya halaman tetap bisa di-scroll di HP.
 * - Materi hanya bisa dipindah di antara saudaranya (topik utama, atau
 *   sub-topik dalam satu induk), sesuai aturan server `reorderUnits`.
 * - Urutan diperbarui langsung di layar, lalu disimpan; kalau gagal,
 *   kembali ke urutan semula.
 */
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from '@tanstack/react-router'
import { Check, GripVertical } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MasteryDots } from '@/components/mastery'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { MasteryLevel } from '@/db/enums'
import { cn } from '@/lib/utils'
import { reorderUnits } from '@/server/units'

export type SortableUnit = {
  id: string
  parentId: string | null
  label: string
  meaning: string | null
  mastery: MasteryLevel | null
  sortOrder: number
  progress: { percent: number; covered: number; size: number; done: boolean } | null
}

type Order = Map<string | null, string[]>

/** Hanya bergerak naik-turun. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * Tujuan hanya dari saudara (parent sama). Tanpa filter ini, saat topik induk
 * digeser, sub-topiknya sendiri ikut terdeteksi sebagai tujuan.
 */
const siblingsOnly: CollisionDetection = (args) => {
  const parent = args.active.data.current?.parent
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.data.current?.parent === parent,
    ),
  })
}

function buildOrder(units: SortableUnit[]): Order {
  const known = new Set(units.map((u) => u.id))
  const order: Order = new Map()
  for (const u of [...units].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = u.parentId && known.has(u.parentId) ? u.parentId : null
    order.set(key, [...(order.get(key) ?? []), u.id])
  }
  return order
}

export function SortableUnitList({
  subjectId,
  units,
  unitLabel,
  onSelect,
}: {
  subjectId: string
  units: SortableUnit[]
  unitLabel: string | null
  onSelect: (unit: SortableUnit) => void
}) {
  const router = useRouter()
  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])
  const [order, setOrder] = useState(() => buildOrder(units))
  const [activeId, setActiveId] = useState<string | null>(null)
  // Data baru dari server (tambah/hapus/edit materi) → susun ulang.
  useEffect(() => setOrder(buildOrder(units)), [units])

  const parentOf = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const [parent, ids] of order) for (const id of ids) map.set(id, parent)
    return map
  }, [order])

  const name = (id: string | number) => byId.get(String(id))?.label ?? 'Materi'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const parent = parentOf.get(String(active.id))
    // Hanya di antara saudara.
    if (parent === undefined || parentOf.get(String(over.id)) !== parent) return

    const ids = order.get(parent) ?? []
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    const previous = order
    setOrder(new Map(order).set(parent, next))
    try {
      await reorderUnits({ data: { subjectId, parentId: parent, orderedIds: next } })
      await router.invalidate()
    } catch {
      setOrder(previous)
      toast.error('Gagal menyimpan urutan. Coba muat ulang halaman.')
    }
  }

  const renderList = (parent: string | null, depth: number) => {
    const ids = order.get(parent) ?? []
    return (
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={cn('divide-y', depth > 0 && 'border-t')}>
          {ids.map((id) => {
            const unit = byId.get(id)
            if (!unit) return null
            const hasKids = (order.get(id) ?? []).length > 0
            return (
              <SortableRow
                key={id}
                unit={unit}
                parent={parent}
                unitLabel={unitLabel}
                depth={depth}
                isParent={hasKids}
                onSelect={onSelect}
              >
                {hasKids && renderList(id, depth + 1)}
              </SortableRow>
            )
          })}
        </ul>
      </SortableContext>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <DndContext
        sensors={sensors}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Tekan spasi untuk mengangkat materi, panah atas/bawah untuk memindah, spasi lagi untuk menaruh, Escape untuk batal.',
          },
          announcements: {
            onDragStart: ({ active }) => `${name(active.id)} diangkat.`,
            onDragOver: ({ active, over }) =>
              over ? `${name(active.id)} di posisi ${name(over.id)}.` : `${name(active.id)} di luar daftar.`,
            onDragEnd: ({ active, over }) =>
              over ? `${name(active.id)} ditaruh di posisi ${name(over.id)}.` : `${name(active.id)} ditaruh.`,
            onDragCancel: ({ active }) => `Batal memindah ${name(active.id)}.`,
          },
        }}
        collisionDetection={siblingsOnly}
        modifiers={[verticalOnly]}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        {renderList(null, 0)}
        {/* Yang ikut bergerak cukup satu baris, bukan seluruh sub-topiknya. */}
        <DragOverlay>
          {activeId && byId.get(activeId) ? (
            <div className="rounded-md border bg-card shadow-lg">
              <RowContent
                unit={byId.get(activeId)!}
                unitLabel={unitLabel}
                isParent={(order.get(activeId) ?? []).length > 0}
                handle={
                  <span className="flex w-10 shrink-0 cursor-grabbing items-center justify-center self-stretch text-muted-foreground">
                    <GripVertical className="size-4" />
                  </span>
                }
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function SortableRow({
  unit,
  parent,
  unitLabel,
  depth,
  isParent,
  onSelect,
  children,
}: {
  unit: SortableUnit
  parent: string | null
  unitLabel: string | null
  depth: number
  isParent: boolean
  onSelect: (unit: SortableUnit) => void
  children?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: unit.id, data: { parent } })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(depth > 0 ? 'bg-muted/40' : 'bg-card', isDragging && 'opacity-40')}
    >
      <RowContent
        unit={unit}
        unitLabel={unitLabel}
        isParent={isParent}
        indent={depth}
        onSelect={() => onSelect(unit)}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Geser untuk mengurutkan ${unit.label}`}
            className="flex w-10 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
      {children}
    </li>
  )
}

/** Isi satu baris: pegangan, nama materi, progres/level. */
function RowContent({
  unit,
  unitLabel,
  isParent,
  indent = 0,
  handle,
  onSelect,
}: {
  unit: SortableUnit
  unitLabel: string | null
  isParent: boolean
  indent?: number
  handle: React.ReactNode
  onSelect?: () => void
}) {
  const p = unit.progress
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate', isParent && 'font-medium')}>
          {unit.label}
          {unit.meaning && <span className="text-muted-foreground"> · {unit.meaning}</span>}
        </p>
        {p && (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={p.percent} className="h-1.5 flex-1" />
            <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
              {p.covered}/{p.size} {unitLabel ?? ''}
            </span>
          </div>
        )}
      </div>
      {p ? (
        p.done ? (
          <Badge>
            <Check /> Selesai
          </Badge>
        ) : p.covered > 0 ? (
          <Badge variant="secondary">Sedang</Badge>
        ) : null
      ) : (
        !isParent && <MasteryDots level={unit.mastery} />
      )}
    </>
  )
  return (
    <div className="flex min-h-12 items-stretch" style={{ paddingLeft: `${indent * 1.25}rem` }}>
      {handle}
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 text-left hover:bg-accent"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3">{body}</div>
      )}
    </div>
  )
}
