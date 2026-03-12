// app/api/narrative/route.ts
// POST /api/narrative
// Returns a precomputed narrative for a given esg_summary row.
// Narratives are generated offline via `python generate_narratives.py`.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/api/auth'

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req)
  if (authError) return authError

  const { summaryId } = await req.json()

  if (!summaryId) {
    return NextResponse.json({ error: 'summaryId required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('esg_summary')
    .select('id, narrative')
    .eq('id', summaryId)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Summary not found' }, { status: 404 })
  }

  if (!row.narrative) {
    return NextResponse.json(
      { error: 'Narrative not found. Run generate_narratives.py to precompute.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ narrative: row.narrative })
}
