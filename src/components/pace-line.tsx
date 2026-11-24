import { formatMonthYear } from '@/lib/dates'
import type { RangePace } from '@/lib/progress/pace'

/** "±35 ayat/minggu → perkiraan selesai ~Jan 2027" (dihitung dari 4 minggu terakhir). */
export function PaceLine({
  pace,
  unitLabel,
  className,
}: {
  pace: RangePace | null
  unitLabel: string | null
  className?: string
}) {
  if (!pace || pace.total === 0) return null
  const unit = unitLabel ?? 'bagian'
  let text: string
  if (pace.done) text = 'Semua materi selesai 🎉'
  else if (!pace.eta) text = 'Belum ada kemajuan 4 minggu terakhir'
  else {
    const rate = pace.perWeek >= 10 ? Math.round(pace.perWeek) : pace.perWeek
    text = `±${rate.toLocaleString('id-ID')} ${unit}/minggu → perkiraan selesai ~${formatMonthYear(pace.eta)}`
  }
  return (
    <p className={className ?? 'text-xs text-muted-foreground'} title="Dihitung dari 4 minggu terakhir">
      {text}
    </p>
  )
}
