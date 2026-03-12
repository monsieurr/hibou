// hooks/useCountryScores.ts
// Lazily loads per-indicator scores for a country from Supabase
// using the latest value per indicator <= selected year.
// Used on the Compare page to show the real indicator heatmap
// without requiring the RSC to pre-fetch scores for all countries.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScoreWithIndicator } from '@/types/hibou'

interface UseCountryScoresResult {
  scores: ScoreWithIndicator[]
  loading: boolean
  error: string | null
}

export function useCountryScores(countryId: number | null, year: number | null): UseCountryScoresResult {
  const [scores, setScores]   = useState<ScoreWithIndicator[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!countryId || !year) return
    setLoading(true)
    setError(null)

    const supabase = createClient()

    supabase
      .from('scores')
      .select(`
        id, country_id, indicator_id, year, raw_value, normalized, data_source,
        indicators (id, code, wb_code, name, pillar, unit, source, description, higher_is_better)
      `)
      .eq('country_id', countryId)
      .lte('year', year)
      .order('indicator_id', { ascending: true })
      .order('year', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        const rows = (data ?? []) as unknown as ScoreWithIndicator[]
        const latestByIndicator = new Map<number, ScoreWithIndicator>()
        for (const row of rows) {
          if (!latestByIndicator.has(row.indicator_id)) {
            latestByIndicator.set(row.indicator_id, row)
          }
        }
        const latest = Array.from(latestByIndicator.values()).sort(
          (a, b) => a.indicator_id - b.indicator_id
        )
        setScores(latest)
        setLoading(false)
      })
  }, [countryId, year])

  return { scores, loading, error }
}
