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
  secretKey: string
}

export function readSupabaseEnv(): SupabaseEnv {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  const missing = [!url && 'SUPABASE_URL', !secretKey && 'SUPABASE_SECRET_KEY'].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(' and ')}. Copy .env.example to .env.local and fill it in from ` +
        `Project settings → API keys in the Supabase dashboard.`,
    )
  }

  // The publishable key cannot bypass row level security, and every table here
  // denies it everything, so it would fail later with a confusing empty result
  // rather than an error. Say so now instead.
  if (secretKey!.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_SECRET_KEY holds a publishable key. That one is meant for browsers and ' +
        'cannot bypass row level security, so it can read and write nothing here. Use the ' +
        'secret key (sb_secret_…) from Project settings → API keys.',
    )
  }

  return { url: url as string, secretKey: secretKey as string }
}
