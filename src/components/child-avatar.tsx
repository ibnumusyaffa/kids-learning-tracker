import { cn } from '@/lib/utils'

/** Pilihan avatar emoji untuk profil anak. */
export const AVATARS = ['🦋', '🦁', '🐳', '🦊', '🐼', '🐣', '🦄', '🐢', '🐝', '🐬', '🦉', '🐨']

/**
 * Latar avatar ditentukan dari emojinya, supaya tiap anak punya warna yang
 * tetap dan mudah dibedakan. Warna lembut (terang/gelap) agar emoji terbaca.
 */
const BACKGROUNDS = [
  'bg-emerald-100 dark:bg-emerald-900/60',
  'bg-amber-100 dark:bg-amber-900/60',
  'bg-sky-100 dark:bg-sky-900/60',
  'bg-rose-100 dark:bg-rose-900/60',
  'bg-violet-100 dark:bg-violet-900/60',
  'bg-teal-100 dark:bg-teal-900/60',
]

function backgroundFor(emoji: string) {
  let hash = 0
  for (const ch of emoji) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return BACKGROUNDS[hash % BACKGROUNDS.length]
}

const SIZES = {
  xs: 'size-6 text-sm',
  sm: 'size-9 text-xl',
  md: 'size-12 text-2xl',
  lg: 'size-16 text-4xl',
} as const

export function ChildAvatar({
  avatar,
  size = 'md',
  className,
}: {
  avatar: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const emoji = avatar || '🙂'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full leading-none select-none',
        SIZES[size],
        backgroundFor(emoji),
        className,
      )}
    >
      {emoji}
    </span>
  )
}
