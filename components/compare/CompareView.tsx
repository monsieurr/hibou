'use client'
// components/compare/CompareView.tsx
// Country comparison page — country selector, score diff, dual radar,
// and real per-indicator heatmap fetched via useCountryScores.

import { useState, useMemo, useEffect } from 'react'
import type { ScoreMode, SummaryWithCountry } from '@/types/hibou'
import { CompareRadar } from '@/components/charts/EsgCharts'
import IndicatorHeatmap from '@/components/compare/IndicatorHeatmap'
import { Panel, PanelHeader, DisclaimerBar, MonoLabel, Tag, ConfidenceBadge, ScoreModeToggle } from '@/components/ui/primitives'
import { CSS, FONT, PILLAR_CSS } from '@/lib/tokens'
import { useYearSelection } from '@/hooks/useYearSelection'
import { getSummaryScore } from '@/lib/utils/scores'

interface Props {
  allSummaries: SummaryWithCountry[]
}

export default function CompareView({ allSummaries }: Props) {
  const { availableYears, selectedYear, setSelectedYear, yearSummaries } = useYearSelection(allSummaries)
  const [scoreMode, setScoreMode] = useState<ScoreMode>('global')

  const sorted = useMemo(
    () => [...yearSummaries].sort((a, b) =>
      (a.countries?.name ?? '').localeCompare(b.countries?.name ?? '')
    ),
    [yearSummaries]
  )

  const [iso2A, setIso2A] = useState(sorted[0]?.countries?.iso2 ?? '')
  const [iso2B, setIso2B] = useState(sorted[1]?.countries?.iso2 ?? '')

  useEffect(() => {
    if (!sorted.length) return
    if (!sorted.some((s) => s.countries?.iso2 === iso2A)) {
      setIso2A(sorted[0]?.countries?.iso2 ?? '')
    }
    if (!sorted.some((s) => s.countries?.iso2 === iso2B) || iso2B === iso2A) {
      const next = sorted.find((s) => s.countries?.iso2 !== iso2A)?.countries?.iso2 ?? ''
      setIso2B(next)
    }
  }, [sorted, iso2A, iso2B])

  const cA = yearSummaries.find((s) => s.countries?.iso2 === iso2A)
  const cB = yearSummaries.find((s) => s.countries?.iso2 === iso2B)

  const radarData = cA && cB
    ? [
        { axis: 'Environmental', a: getSummaryScore(cA, 'E', scoreMode) ?? 0, b: getSummaryScore(cB, 'E', scoreMode) ?? 0 },
        { axis: 'Social',        a: getSummaryScore(cA, 'S', scoreMode) ?? 0, b: getSummaryScore(cB, 'S', scoreMode) ?? 0 },
        { axis: 'Governance',    a: getSummaryScore(cA, 'G', scoreMode) ?? 0, b: getSummaryScore(cB, 'G', scoreMode) ?? 0 },
      ]
    : []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Country Comparison</h1>
        {selectedYear ? <Tag>DATA YEAR {selectedYear}</Tag> : null}
      </div>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>
        Compare percentile scores and indicator gaps side‑by‑side
      </p>

      <DisclaimerBar />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {availableYears.length > 1 && (
          <>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: CSS.textDim, letterSpacing: '1px' }}>
              YEAR
            </span>
            <select
              className="select-filter"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </>
        )}
        <ScoreModeToggle mode={scoreMode} onChange={setScoreMode} />
      </div>

      {/* ── Country selectors ── */}
      <div className="compare-selectors">
        <CountrySelector
          summaries={sorted}
          value={iso2A}
          onChange={setIso2A}
          exclude={iso2B}
        />
        <div className="compare-vs">
          <MonoLabel>VS</MonoLabel>
        </div>
        <CountrySelector
          summaries={sorted}
          value={iso2B}
          onChange={setIso2B}
          exclude={iso2A}
        />
      </div>

      {cA && cB && (
        <>
          {/* ── Score comparison row ── */}
          <div className="compare-score-row">
            <CountryScorePanel summary={cA} scoreMode={scoreMode} />
            <DiffColumn a={cA} b={cB} scoreMode={scoreMode} />
            <CountryScorePanel summary={cB} scoreMode={scoreMode} />
          </div>

          {/* ── Radar + heatmap ── */}
          <div className="compare-grid">
            <Panel>
              <PanelHeader
                title="ESG Radar"
                right={
                  <RadarLegend nameA={cA.countries?.name ?? ''} nameB={cB.countries?.name ?? ''} />
                }
              />
              <CompareRadar
                data={radarData}
                nameA={cA.countries?.name ?? ''}
                nameB={cB.countries?.name ?? ''}
              />
            </Panel>

            <Panel>
              <PanelHeader
                title="Indicator Heatmap"
                right={
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: CSS.textDim }}>
                    {cA.countries?.iso2} vs {cB.countries?.iso2} · {selectedYear}
                  </span>
                }
              />
              <div style={{ padding: '12px 14px' }}>
                  <IndicatorHeatmap
                    countryIdA={cA.country_id}
                    countryIdB={cB.country_id}
                    isoA={cA.countries?.iso2 ?? ''}
                    isoB={cB.countries?.iso2 ?? ''}
                    year={selectedYear}
                    mode={scoreMode}
                  />
                </div>
              </Panel>
            </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CountrySelector({
  summaries, value, onChange, exclude,
}: {
  summaries: SummaryWithCountry[]
  value: string
  onChange: (v: string) => void
  exclude: string
}) {
  return (
    <select
      className="country-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {summaries
        .filter((s) => s.countries?.iso2 !== exclude)
        .map((s) => (
          <option key={s.countries?.iso2} value={s.countries?.iso2}>
            {s.countries?.name}
          </option>
        ))}
    </select>
  )
}

const SCORE_ROWS = [
  { pillar: 'E' as const, label: 'ENV', color: PILLAR_CSS.E },
  { pillar: 'S' as const, label: 'SOC', color: PILLAR_CSS.S },
  { pillar: 'G' as const, label: 'GOV', color: PILLAR_CSS.G },
  { pillar: 'ESG' as const, label: 'ESG', color: CSS.accent },
]

function CountryScorePanel({
  summary,
  scoreMode,
}: {
  summary: SummaryWithCountry
  scoreMode: ScoreMode
}) {
  return (
    <Panel>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${CSS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="country-name" style={{ fontSize: 18 }}>{summary.countries?.name}</div>
          <ConfidenceBadge coverage={summary.esg_coverage} />
        </div>
        <div className="country-meta">{summary.countries?.region} · {summary.countries?.income_group}</div>
      </div>
      <div className="score-grid">
        {SCORE_ROWS.map(({ pillar, label, color }) => (
          <div key={pillar} className="score-cell">
            <div className="score-label">{label}</div>
            <div className="score-value" style={{ color, fontSize: 20 }}>
              {getSummaryScore(summary, pillar, scoreMode) != null
                ? Math.round(getSummaryScore(summary, pillar, scoreMode)!)
                : '–'}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function DiffColumn({
  a,
  b,
  scoreMode,
}: {
  a: SummaryWithCountry
  b: SummaryWithCountry
  scoreMode: ScoreMode
}) {
  const diffs = SCORE_ROWS.map(({ pillar, label }) => ({
    label,
    diff: (getSummaryScore(a, pillar, scoreMode) ?? 0) - (getSummaryScore(b, pillar, scoreMode) ?? 0),
  }))

  return (
    <div className="compare-diff">
      {diffs.map(({ label, diff }) => (
        <div key={label} style={{
          padding: '4px 8px', background: CSS.panel,
          border: `1px solid ${CSS.border}`, borderRadius: 5,
          textAlign: 'center', minWidth: 56,
        }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim }}>{label}</div>
          <div style={{
            fontFamily: FONT.mono, fontSize: 13, fontWeight: 500,
            color: diff > 0 ? CSS.accentE : diff < 0 ? CSS.danger : CSS.textDim,
          }}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  )
}

function RadarLegend({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {([
        [nameA, PILLAR_CSS.E],
        [nameB, PILLAR_CSS.S],
      ] as [string, string][]).map(([name, color]) => (
        <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT.mono, fontSize: 10, color }}>
          <span style={{ width: 16, height: 2, background: color, display: 'inline-block' }} />
          {name}
        </span>
      ))}
    </div>
  )
}
