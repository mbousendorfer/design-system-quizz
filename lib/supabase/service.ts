import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { readSupabaseEnv } from '@/lib/supabase/env'

/**
 * The service-role client. Bypasses row level security, which is the point: the
 * tables deny everything to every other role.
 *
 * The `server-only` import above makes importing this from a client component a
 * build error rather than a leaked key.
 */
let cached: SupabaseClient | null = null

export function serviceClient(): SupabaseClient {
  if (cached) return cached

  const { url, secretKey } = readSupabaseEnv()
  cached = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
