import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { CalendarCheck, Download, LogOut, UserCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { getViewer } from '@/server/family'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const viewer = await getViewer()
    if (!viewer) throw redirect({ to: '/login' })
    if (!viewer.family) throw redirect({ to: '/onboarding' })
    return { viewer: { ...viewer, family: viewer.family } }
  },
  component: AppLayout,
})

const NAV = [
  { to: '/today', label: 'Hari Ini', icon: CalendarCheck },
  { to: '/children', label: 'Anak', icon: Users },
] as const

function AppLayout() {
  const { viewer } = Route.useRouteContext()
  const router = useRouter()

  async function signOut() {
    await authClient.signOut()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs text-muted-foreground">
            {viewer.family.name}
          </p>
          <p className="font-semibold">Kids Tracker</p>
        </div>
        <nav className="hidden gap-1 md:flex">
          {NAV.map((item) => (
            <Button key={item.to} variant="ghost" size="sm" asChild>
              <Link to={item.to} activeProps={{ className: 'bg-accent' }}>
                <item.icon />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu akun">
              <UserCircle />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm">{viewer.user.name}</span>
              <span className="block text-xs text-muted-foreground">{viewer.user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/api/export" download>
                <Download /> Ekspor semua data (JSON)
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/api/export?format=csv" download>
                <Download /> Ekspor catatan (CSV)
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 px-4 py-4 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Navigasi bawah untuk mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-2 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
            activeProps={{ className: 'text-primary' }}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
