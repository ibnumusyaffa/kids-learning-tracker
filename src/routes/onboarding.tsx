import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createFamily, getViewer } from '@/server/family'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const viewer = await getViewer()
    if (!viewer) throw redirect({ to: '/login' })
    if (viewer.family) throw redirect({ to: '/today' })
    return { viewer }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { viewer } = Route.useRouteContext()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get('name'))
    setPending(true)
    try {
      await createFamily({ data: { name } })
      await router.navigate({ to: '/today' })
    } catch {
      toast.error('Gagal membuat keluarga')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Halo, {viewer.user.name} 👋</CardTitle>
          <CardDescription>
            Buat keluarga dulu. Nanti pasangan bisa diundang ke keluarga ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama keluarga</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Keluarga Ibnu"
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              Buat keluarga
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
