// app/api/context/route.ts
// POST /api/context
// Returns stored ESG-relevant structural context for a country.
// Context is precomputed offline via `python generate_context.py`.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/api/auth'
import type { CountryContext } from '@/types/hibou'

export async function POST(req: NextRequest) {
  const authError = await requireApiAuth(req)
  if (authError) return authError

  const { summaryId } = await req.json()

  if (!summaryId) {
    return NextResponse.json({ error: 'summaryId required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: summary, error: summaryError } = await supabase
    .from('esg_summary')
    .select('id, country_id')
    .eq('id', summaryId)
    .single()

  if (summaryError || !summary) {
    return NextResponse.json({ error: 'Summary not found' }, { status: 404 })
  }

  const { data: context, error } = await supabase
    .from('country_context')
    .select('country_id, gdp_per_capita, main_industries, climate_zone, esg_context')
    .eq('country_id', summary.country_id)
    .single()

  if (error || !context) {
    return NextResponse.json(
      { error: 'Context not found. Run generate_context.py to precompute.' },
      { status: 404 }
    )
  }

  return NextResponse.json(context as CountryContext)
}
