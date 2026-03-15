'use client'
// components/profile/CountryInfoCard.tsx
// Displays static country info + year-specific macro stats.

import type { CountryInfo, CountryStat } from '@/types/hibou'
import { Panel, PanelHeader, PanelBody } from '@/components/ui/primitives'
import { CSS, FONT } from '@/lib/tokens'

interface Props {
  info: CountryInfo | null
  stats: CountryStat | null
  selectedYear: number
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim,
        letterSpacing: '0.8px', textTransform: 'uppercase',
        minWidth: 108, paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: CSS.text, lineHeight: 1.4 }}>{value}</span>
    </div>
  )
}

function formatNumber(value: number | null, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return ':'
  const rounded = Math.round(value)
  return `${rounded.toLocaleString()}${suffix}`
}

function formatUsd(value: number | null): string {
  if (value == null || Number.isNaN(value)) return ':'
  const rounded = Math.round(value)
  return `$${rounded.toLocaleString()}`
}

export default function CountryInfoCard({ info, stats, selectedYear }: Props) {
  const statsYear = stats?.year ?? null
  const statsYearLabel = statsYear
    ? `${statsYear}${statsYear < selectedYear ? ` (latest ≤ ${selectedYear})` : ''}`
    : ':'
  const hasData = Boolean(info || stats)

  return (
    <Panel>
      <PanelHeader title="Country Info" />
      <PanelBody>
        <div style={{ marginBottom: 12 }}>
          <Row label="Capital" value={info?.capital_city ?? ':'} />
          <Row label="Languages" value={info?.official_languages ?? ':'} />
          <Row label="Area" value={formatNumber(info?.area_km2 ?? null, ' km²')} />
        </div>

        <div style={{ height: 1, background: CSS.border, margin: '12px 0' }} />

        <div style={{ marginBottom: 8 }}>
          <Row label="GDP (USD)" value={formatUsd(stats?.gdp_usd ?? null)} />
          <Row label="Population" value={formatNumber(stats?.population ?? null)} />
          <Row label="GDP / Capita" value={formatUsd(stats?.gdp_per_capita ?? null)} />
          <Row label="Data Year" value={statsYearLabel} />
        </div>

        <p style={{ fontSize: 11, color: CSS.textDim }}>
          Source: {stats?.source ?? info?.source ?? ':'}
        </p>
        {!hasData && (
          <p style={{ fontSize: 11, color: CSS.textDim, marginTop: 6 }}>
            No country info yet. Run <code>python ingest_wdi.py</code> for WDI stats and
            <code>python ingest_restcountries.py</code> for capital/languages.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}
