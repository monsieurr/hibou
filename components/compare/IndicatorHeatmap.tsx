'use client'
// components/compare/IndicatorHeatmap.tsx
// Shows per-indicator scores side-by-side as colored cells.
// Fetches real scores from Supabase via the useCountryScores hook —
// no more fake hashed values.

import { useCountryScores } from '@/hooks/useCountryScores'
import { scoreToColor } from '@/lib/utils/scores'
import { PILLAR_CSS, CSS, FONT } from '@/lib/tokens'
import { LoadingDots } from '@/components/ui/primitives'
import type { Pillar, ScoreMode } from '@/types/hibou'

interface Props {
  countryIdA: number
  countryIdB: number
  isoA: string
  isoB: string
  year: number | null
  mode: ScoreMode
}

export default function IndicatorHeatmap({ countryIdA, countryIdB, isoA, isoB, year, mode }: Props) {
  const a = useCountryScores(countryIdA, year)
  const b = useCountryScores(countryIdB, year)

  if (!year) {
    return (
      <p style={{ fontSize: 12, color: CSS.textDim, padding: 12 }}>
        Select a year to view indicator comparisons.
      </p>
    )
  }
  if (a.loading || b.loading) return <LoadingDots />
  if (a.error || b.error) {
    return (
      <p style={{ fontSize: 12, color: CSS.danger, padding: 12 }}>
        Error loading scores: {a.error ?? b.error}
      </p>
    )
  }

  // Build a map from indicator code → score for each country
  const mapA = Object.fromEntries(a.scores.map((s) => [s.indicators?.code, s]))
  const mapB = Object.fromEntries(b.scores.map((s) => [s.indicators?.code, s]))

  // Union of all indicator codes, sorted by pillar then code
  const allCodes = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])].sort()

  if (allCodes.length === 0) {
    return <p style={{ fontSize: 12, color: CSS.textDim, padding: 12 }}>No indicator data available for this pair.</p>
  }

  return (
    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim, marginBottom: 6 }}>
        Mode: {mode.toUpperCase()} · Year: {year} · Indicators use global percentiles
      </div>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 40px 40px', gap: 4, marginBottom: 6 }}>
        <span />
        <span />
        <span style={{ fontFamily: FONT.mono, fontSize: 9, color: PILLAR_CSS.E, textAlign: 'center' }}>{isoA}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 9, color: PILLAR_CSS.S, textAlign: 'center' }}>{isoB}</span>
      </div>

      {allCodes.map((code) => {
        const sA = mapA[code]
        const sB = mapB[code]
        const ind = sA?.indicators ?? sB?.indicators
        if (!ind) return null

        const normA = sA?.normalized != null ? Math.round(sA.normalized * 100) : null
        const normB = sB?.normalized != null ? Math.round(sB.normalized * 100) : null

        return (
          <div
            key={code}
            style={{ display: 'grid', gridTemplateColumns: '28px 1fr 40px 40px', gap: 4, alignItems: 'center', marginBottom: 3 }}
          >
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim }}>{code}</span>
            <span style={{ fontSize: 11, color: CSS.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ind.name}
            </span>
            <HeatCell score={normA} pillar={ind.pillar as Pillar} />
            <HeatCell score={normB} pillar={ind.pillar as Pillar} />
          </div>
        )
      })}
    </div>
  )
}

function HeatCell({ score, pillar }: { score: number | null; pillar: Pillar }) {
  return (
    <div style={{
      height: 18,
      borderRadius: 3,
      background: scoreToColor(score, pillar),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
        {score ?? '–'}
      </span>
    </div>
  )
}
