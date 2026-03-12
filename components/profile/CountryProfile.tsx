'use client'
// components/profile/CountryProfile.tsx
// Orchestrates the Country Profile page layout.
// Sub-components handle individual concerns.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type {
  Country,
  CountryContext,
  CountryInfo,
  CountryStat,
  EsgSummary,
  ScoreMode,
  ScoreWithIndicator,
} from '@/types/hibou'
import IndicatorCard from '@/components/ui/IndicatorCard'
import NarrativeCard from '@/components/profile/NarrativeCard'
import ContextCard from '@/components/profile/ContextCard'
import CountryInfoCard from '@/components/profile/CountryInfoCard'
import { EsgRadar, PillarBar } from '@/components/charts/EsgCharts'
import {
  Panel, PanelHeader, PanelBody,
  ScoreChip, ConfidenceBadge, ScoreModeToggle,
  PillarSectionHeader,
} from '@/components/ui/primitives'
import { PILLAR_CSS, CSS, FONT } from '@/lib/tokens'
import { getSummaryScore, getSummaryRank, getSummaryCoverage } from '@/lib/utils/scores'

interface Props {
  country:  Country
  summary:  EsgSummary
  scores:   ScoreWithIndicator[]
  context:  CountryContext | null
  info:     CountryInfo | null
  stats:    CountryStat | null
  narrative: string | null
  narrativeYear: number | null
  availableYears: number[]
  selectedYear: number
}

const PILLARS = [
  { key: 'E' as const },
  { key: 'S' as const },
  { key: 'G' as const },
]

export default function CountryProfile({
  country,
  summary,
  scores,
  context,
  info,
  stats,
  narrative,
  narrativeYear,
  availableYears,
  selectedYear,
}: Props) {
  const router = useRouter()
  const [scoreMode, setScoreMode] = useState<ScoreMode>('global')

  const scoreYears = scores.map((s) => s.year).filter((y) => Number.isFinite(y))
  const minDataYear = scoreYears.length ? Math.min(...scoreYears) : null
  const maxDataYear = scoreYears.length ? Math.max(...scoreYears) : null
  const dataYearLabel = minDataYear && maxDataYear
    ? (minDataYear === maxDataYear ? `${maxDataYear}` : `${minDataYear}–${maxDataYear}`)
    : '—'
  const dataYearNote = maxDataYear && maxDataYear < summary.year
    ? ` (latest ≤ ${summary.year})`
    : ''

  const radarData = [
    { axis: 'Environmental', score: getSummaryScore(summary, 'E', scoreMode) ?? 0 },
    { axis: 'Social',        score: getSummaryScore(summary, 'S', scoreMode) ?? 0 },
    { axis: 'Governance',    score: getSummaryScore(summary, 'G', scoreMode) ?? 0 },
  ]

  const barData = [
    { name: 'E', score: getSummaryScore(summary, 'E', scoreMode) ?? 0, fill: PILLAR_CSS.E },
    { name: 'S', score: getSummaryScore(summary, 'S', scoreMode) ?? 0, fill: PILLAR_CSS.S },
    { name: 'G', score: getSummaryScore(summary, 'G', scoreMode) ?? 0, fill: PILLAR_CSS.G },
  ]

  const scoresByPillar = {
    E: scores.filter((s) => s.indicators?.pillar === 'E'),
    S: scores.filter((s) => s.indicators?.pillar === 'S'),
    G: scores.filter((s) => s.indicators?.pillar === 'G'),
  }

  return (
    <div className="profile-page">
      {/* ── Top bar ── */}
      <div className="profile-header">
        <button className="back-btn" onClick={() => router.push('/')} type="button">
          ← WORLD MAP
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ConfidenceBadge coverage={getSummaryCoverage(summary, 'ESG')} />
        </div>
      </div>

      {/* ── Country title ── */}
      <div style={{ marginBottom: 12 }}>
        <h1 className="page-title">{country.name}</h1>
        {(info?.capital_city || info?.official_languages) && (
          <p style={{ fontFamily: FONT.mono, fontSize: 11, color: CSS.textDim, letterSpacing: '0.4px', marginTop: 4 }}>
            Capital: {info?.capital_city ?? '—'} · Languages: {info?.official_languages ?? '—'}
          </p>
        )}
        <p style={{ fontFamily: FONT.mono, fontSize: 11, color: CSS.textDim, letterSpacing: '0.5px' }}>
          {country.iso3} · {country.region} · {country.income_group} · Score year: {summary.year} · Data years: {dataYearLabel}{dataYearNote}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {availableYears.length > 1 && (
          <>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: CSS.textDim, letterSpacing: '1px' }}>
              YEAR
            </span>
            <select
              className="select-filter"
              value={selectedYear}
              onChange={(e) => {
                const year = e.target.value
                router.push(`/country/${country.iso2}?year=${year}`)
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}
        <ScoreModeToggle mode={scoreMode} onChange={setScoreMode} />
      </div>

      {/* ── Score chips ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <ScoreChip
          pillar="E"
          label="ENV"
          score={getSummaryScore(summary, 'E', scoreMode)}
          rank={getSummaryRank(summary, 'E', scoreMode)}
        />
        <ScoreChip
          pillar="S"
          label="SOC"
          score={getSummaryScore(summary, 'S', scoreMode)}
          rank={getSummaryRank(summary, 'S', scoreMode)}
        />
        <ScoreChip
          pillar="G"
          label="GOV"
          score={getSummaryScore(summary, 'G', scoreMode)}
          rank={getSummaryRank(summary, 'G', scoreMode)}
        />
        <ScoreChip
          pillar="ESG"
          label="ESG"
          score={getSummaryScore(summary, 'ESG', scoreMode)}
          rank={getSummaryRank(summary, 'ESG', scoreMode)}
        />
      </div>

      <div className="profile-grid">
        {/* ── Left column: charts + narrative + context ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Panel>
            <PanelHeader title="ESG Radar" />
            <EsgRadar data={radarData} />
          </Panel>

          <Panel>
            <PanelHeader title="Pillar Breakdown" />
            <PanelBody style={{ padding: '8px 0 4px' }}>
              <PillarBar data={barData} />
            </PanelBody>
          </Panel>

          {/* DEV-03: Narrative card */}
          <NarrativeCard narrative={narrative} narrativeYear={narrativeYear} />

          {/* DEV-03: Context card — GDP, industries, climate zone */}
          <ContextCard
            country={country}
            summary={summary}
            context={context}
            dataYearLabel={`${dataYearLabel}${dataYearNote}`}
          />

          <CountryInfoCard
            info={info}
            stats={stats}
            selectedYear={selectedYear}
          />

        </div>

        {/* ── Right column: indicator grids ── */}
        <div>
          {PILLARS.map(({ key }) => (
            <Panel key={key} style={{ marginBottom: 16 }}>
              <PillarSectionHeader pillar={key} score={getSummaryScore(summary, key, scoreMode)} />
              <div style={{ padding: '8px 12px' }}>
                <div className="indicator-grid">
                  {scoresByPillar[key].length > 0
                    ? scoresByPillar[key].map((s) => <IndicatorCard key={s.id} score={s} />)
                    : <p style={{ fontSize: 12, color: CSS.textDim, padding: '8px 0' }}>No indicator data available.</p>
                  }
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  )
}
