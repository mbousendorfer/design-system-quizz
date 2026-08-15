/**
 * Supabase configuration.
 *
 * Note what is *not* here: no `NEXT_PUBLIC_*` Supabase variable. The browser
 * never talks to Supabase in this app, so there is no anon key to ship and no
 * client-side query path to audit. Every read and write goes through server code
 * holding the service key.
 *
 * This module deliberately has no `server-only` guard so the seed and export
 * scripts can share it. The client itself does — see `service.ts`.
 */

export const SHOTS_BUCKET = 'shots'

export type SupabaseEnv = {
  url: string
  serviceRoleKey: string
}

export function readSupabaseEnv(): SupabaseEnv {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing = [
    !url && 'SUPABASE_URL',
    !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(' and ')}. Copy .env.example to .env.local and fill in the ` +
        `values from your Supabase project settings (Project settings → API).`,
    )
  }

  return { url: url as string, serviceRoleKey: serviceRoleKey as string }
}
