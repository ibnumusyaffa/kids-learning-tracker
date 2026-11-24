import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import appCss from '../styles.css?url'

// Service worker hanya di production (di dev mengganggu HMR).
const SW_SCRIPT = `if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`

const THEME_INIT_SCRIPT = `(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Kids Tracker' },
      { name: 'description', content: 'Catatan belajar anak untuk orang tua.' },
      { name: 'theme-color', content: '#2f8462' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Kids Tracker' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.png', type: 'image/png', sizes: '48x48' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <Toaster position="top-center" />
        <Scripts />
        {import.meta.env.PROD && <script dangerouslySetInnerHTML={{ __html: SW_SCRIPT }} />}
      </body>
    </html>
  )
}
