import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { ChildAvatar } from '@/components/child-avatar'
import { ChildFormDialog } from '@/components/child-form-dialog'
import { formatAge, todayIn } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { listChildren } from '@/server/children'

export const Route = createFileRoute('/_app/children/')({
  loader: () => listChildren(),
  component: ChildrenPage,
})

function ChildrenPage() {
  const children = Route.useLoaderData()
  const { viewer } = Route.useRouteContext()
  const today = todayIn(viewer.family.timezone)
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Anak</h1>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Tambah
        </Button>
      </div>

      {children.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada profil anak. Tambahkan dulu untuk mulai mencatat.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {children.map((child) => (
            <Link
              key={child.id}
              to="/children/$childId"
              params={{ childId: child.id }}
            >
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center gap-3">
                  <ChildAvatar avatar={child.avatar} size="md" />
                  <div className="flex-1">
                    <p className="font-medium">{child.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatAge(child.birthDate, today) ?? 'Umur belum diisi'}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ChildFormDialog open={adding} onOpenChange={setAdding} today={today} />
    </div>
  )
}
