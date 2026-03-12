// lib/supabase/service.ts
// Service-role Supabase client — bypasses RLS for trusted server-side writes.
// NEVER expose this client to the browser. Use only in API routes and server actions.
//
// Required env var: SUPABASE_KEY (Secret key / service role, NOT the publishable key)
// The publishable (anon) key cannot write to tables protected by RLS policies.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key  = process.env.SUPABASE_KEY! // Secret key (service role) — server only

  if (!key) {
    throw new Error(
      'SUPABASE_KEY (Secret key / service role) is not set. ' +
      'Add it to .env.local. Never expose it to the browser.'
    )
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
