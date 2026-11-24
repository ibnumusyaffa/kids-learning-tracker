import { createFileRoute, redirect } from '@tanstack/react-router'
import { getViewer } from '@/server/family'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const viewer = await getViewer()
    if (!viewer) throw redirect({ to: '/login' })
    if (!viewer.family) throw redirect({ to: '/onboarding' })
    throw redirect({ to: '/today' })
  },
})
