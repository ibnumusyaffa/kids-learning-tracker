/**
 * Konfigurasi better-auth. Hanya untuk server.
 *
 * Keluarga = organization better-auth. Lihat docs.md bagian 5.4.
 */
import '@tanstack/react-start/server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from 'cloudflare:workers'
import { getDb, schema } from '@/db'

export const DEFAULT_TIMEZONE = 'Asia/Jakarta'

function createAuth() {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), { provider: 'sqlite', schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: google,
    plugins: [
      organization({
        schema: {
          organization: {
            additionalFields: {
              timezone: {
                type: 'string',
                required: true,
                defaultValue: DEFAULT_TIMEZONE,
              },
            },
          },
        },
      }),
      // Harus plugin terakhir.
      tanstackStartCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

let auth: Auth | undefined

export function getAuth(): Auth {
  auth ??= createAuth()
  return auth
}
