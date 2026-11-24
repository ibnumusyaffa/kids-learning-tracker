/**
 * Grafik kecil berbasis SVG/HTML. Satu hue (ramp --heat-*), tanpa library.
 * Spesifikasi mengikuti skill dataviz: garis 2px, marker r=4 dengan cincin
 * permukaan 2px, celah 2px antar sel, grid hairline, tooltip saat hover.
 */
import type { LocalDate } from '@/lib/dates'
import { formatShortDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

const HEAT = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)']

// ---------------------------------------------------------------------------
// Heatmap aktivitas
// ---------------------------------------------------------------------------

/** Level 0–4 dari menit belajar; ada sesi tanpa menit = level 1. */
export function activityLevel(sessions: number, minutes: number) {
  if (sessions === 0) return 0
  if (minutes >= 45) return 4
  if (minutes >= 25) return 3
  if (minutes >= 10) return 2
  return 1
}

export function ActivityHeatmap({
  days,
  today,
}: {
  /** Urut naik, dimulai hari Senin. */
  days: { date: LocalDate; sessions: number; minutes: number }[]
  today: LocalDate
}) {
  const cell = 13
  const gap = 2
  const step = cell + gap
  const left = 26
  const top = 16
  const weeks = Math.ceil(days.length / 7)
  const width = left + weeks * step
  const height = top + 7 * step

  const monthLabels: { x: number; label: string }[] = []
  for (let w = 0; w < weeks; w++) {
    const first = days[w * 7]
    if (!first) continue
    const prev = days[(w - 1) * 7]
    if (!prev || prev.date.slice(5, 7) !== first.date.slice(5, 7)) {
      monthLabels.push({ x: left + w * step, label: formatShortDate(first.date).split(' ').at(-1)! })
    }
  }

  return (
    <figure className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`Aktivitas ${weeks} minggu terakhir`}
          className="block"
        >
          {monthLabels.map((m) => (
            <text key={m.x} x={m.x} y={10} className="fill-muted-foreground text-[9px]">
              {m.label}
            </text>
          ))}
          {['Sen', 'Rab', 'Jum'].map((d, i) => (
            <text
              key={d}
              x={0}
              y={top + (i * 2) * step + cell - 3}
              className="fill-muted-foreground text-[9px]"
            >
              {d}
            </text>
          ))}
          {days.map((d, i) => {
            const level = d.date > today ? -1 : activityLevel(d.sessions, d.minutes)
            if (level < 0) return null
            return (
              <rect
                key={d.date}
                x={left + Math.floor(i / 7) * step}
                y={top + (i % 7) * step}
                width={cell}
                height={cell}
                rx={2}
                fill={HEAT[level]}
                className={cn(d.date === today && 'stroke-foreground')}
                strokeWidth={d.date === today ? 1 : 0}
              >
                <title>
                  {`${formatShortDate(d.date)}: ${
                    d.sessions ? `${d.sessions} catatan · ${d.minutes} menit` : 'tidak ada catatan'
                  }`}
                </title>
              </rect>
            )
          })}
        </svg>
      </div>
      <figcaption className="flex items-center gap-1 text-xs text-muted-foreground">
        Sedikit
        {HEAT.map((c) => (
          <span key={c} className="inline-block size-3 rounded-[2px]" style={{ background: c }} />
        ))}
        Banyak
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Bar horizontal (nilai di ujung bar)
// ---------------------------------------------------------------------------

export function BarList({
  rows,
  unit,
}: {
  rows: { key: string; label: string; value: number }[]
  unit: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <p className="text-sm">{r.label}</p>
          <div className="flex items-center gap-2" title={`${r.label}: ${r.value} ${unit}`}>
            <div className="h-2.5 flex-1">
              <div
                className="h-full rounded-r-[4px] bg-heat-3"
                style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0 }}
              />
            </div>
            <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
              {r.value} {unit}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Peta materi range (mis. peta hafalan)
// ---------------------------------------------------------------------------

export function rangeLevel(u: { percent: number; done: boolean }) {
  if (u.done) return 4
  if (u.percent >= 67) return 3
  if (u.percent >= 34) return 2
  if (u.percent > 0) return 1
  return 0
}

export function UnitMap({
  units,
  unitLabel,
}: {
  units: { id: string; label: string; size: number; covered: number; percent: number; done: boolean }[]
  unitLabel: string | null
}) {
  return (
    <figure className="space-y-2">
      <div className="flex flex-wrap gap-0.5">
        {units.map((u) => {
          const level = rangeLevel(u)
          // Nomor surah dari label "78. An-Naba"; selain itu inisial.
          const short = /^(\d+)\./.exec(u.label)?.[1] ?? u.label.slice(0, 3)
          return (
            <span
              key={u.id}
              title={`${u.label}: ${u.covered}/${u.size} ${unitLabel ?? ''}${u.done ? ' · selesai' : ''}`}
              className={cn(
                'flex h-8 min-w-8 items-center justify-center rounded-[4px] px-1 text-[10px] font-medium tabular-nums',
                level >= 3 ? 'text-white dark:text-black' : 'text-foreground',
              )}
              style={{ background: HEAT[level] }}
            >
              {short}
            </span>
          )
        })}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {['Belum', '< ⅓', '⅓–⅔', '> ⅔', 'Selesai'].map((label, i) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span className="inline-block size-3 rounded-[2px]" style={{ background: HEAT[i] }} />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
