// lib/api/auth.ts
// Shared guard for LLM-powered API routes (/api/narrative, /api/context).
//
// Strategy:
// - Prefer Supabase auth session (user must be signed in).
// - Allow a server-to-server admin secret via X-Hibou-Admin for trusted callers.
//
// This prevents public traffic from burning Anthropic credits.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Call at the top of every AI API route handler.
 * Returns a 401 NextResponse if the request is not authorised,
 * or null if the request is valid (caller may proceed).
 *
 * Usage:
 *   const authError = await requireApiAuth(req)
 *   if (authError) return authError
 */
export async function requireApiAuth(req: NextRequest): Promise<NextResponse | null> {
  const adminSecret = process.env.HIBOU_API_SECRET
  const adminToken = req.headers.get('x-hibou-admin')

  if (adminSecret && adminToken && adminToken === adminSecret) {
    return null // trusted server-to-server caller
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // signed-in user
}
