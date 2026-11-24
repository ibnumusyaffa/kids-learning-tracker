import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { NotFound, RouteError, RoutePending } from './components/route-states'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: RouteError,
    defaultPendingComponent: RoutePending,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
