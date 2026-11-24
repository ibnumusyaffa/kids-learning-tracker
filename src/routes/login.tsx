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
import { Separator } from '@/components/ui/separator'
import { authClient } from '@/lib/auth-client'
import { getViewer } from '@/server/family'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const viewer = await getViewer()
    if (viewer) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setPending(true)
    const { error } =
      mode === 'signin'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: String(form.get('name')),
          })
    setPending(false)
    if (error) {
      toast.error(error.message ?? 'Gagal masuk')
      return
    }
    await router.navigate({ to: '/' })
  }

  async function signInWithGoogle() {
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    })
    if (error) toast.error(error.message ?? 'Login Google belum dikonfigurasi')
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Kids Tracker</CardTitle>
          <CardDescription>
            {mode === 'signin'
              ? 'Masuk untuk mencatat belajar anak.'
              : 'Buat akun orang tua.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={signInWithGoogle}
          >
            Lanjut dengan Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            atau
            <Separator className="flex-1" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" name="name" required autoComplete="name" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {mode === 'signin' ? 'Masuk' : 'Daftar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === 'signin' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
