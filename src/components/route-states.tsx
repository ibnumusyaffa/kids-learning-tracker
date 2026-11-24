import { Link, type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function NotFound() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl">🔍</p>
      <h1 className="text-lg font-semibold">Halaman tidak ditemukan</h1>
      <p className="text-sm text-muted-foreground">
        Data ini tidak ada, sudah diarsipkan, atau bukan milik keluargamu.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Kembali ke beranda</Link>
      </Button>
    </div>
  )
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl">😵</p>
      <h1 className="text-lg font-semibold">Terjadi kesalahan</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {import.meta.env.DEV && error instanceof Error
          ? error.message
          : 'Coba muat ulang halaman.'}
      </p>
      <Button
        variant="outline"
        onClick={() => {
          reset()
          router.invalidate()
        }}
      >
        Coba lagi
      </Button>
    </div>
  )
}

/** Tampil saat loader halaman lebih lambat dari ~1 detik. */
export function RoutePending() {
  return (
    <div className="space-y-4 p-1" aria-busy="true" aria-label="Memuat">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}
