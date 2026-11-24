import type { MasteryLevel } from '@/db/enums'
import { MASTERY_LEVELS } from '@/db/enums'
import { MASTERY_META } from '@/lib/subject-meta'
import { cn } from '@/lib/utils'

/** ● ● ○ — level penguasaan sebagai titik. */
export function MasteryDots({
  level,
  className,
}: {
  level: MasteryLevel | null
  className?: string
}) {
  const filled = level ? MASTERY_META[level].dots : 0
  return (
    <span
      className={cn('inline-flex gap-0.5', className)}
      aria-label={level ? MASTERY_META[level].label : 'Belum dinilai'}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'size-2 rounded-full border border-primary',
            i <= filled && 'bg-primary',
          )}
        />
      ))}
    </span>
  )
}

/** Tombol pilih level: Belum / Kenal / Bisa / Mahir. */
export function MasteryPicker({
  value,
  onChange,
  disabled,
}: {
  value: MasteryLevel | null
  onChange: (level: MasteryLevel) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-4 gap-1" role="radiogroup">
      {MASTERY_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          disabled={disabled}
          onClick={() => onChange(level)}
          className={cn(
            'flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs',
            value === level && 'border-primary bg-accent font-medium',
          )}
        >
          <MasteryDots level={level} />
          {MASTERY_META[level].label}
        </button>
      ))}
    </div>
  )
}
