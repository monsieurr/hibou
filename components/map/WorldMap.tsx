'use client'
// components/map/WorldMap.tsx
// Geographic choropleth map using react-simple-maps.

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps'
import type { SummaryWithCountry, EsgSummary, Pillar, ScoreMode } from '@/types/hibou'
import {
  scoreToColor,
  formatScore,
  formatRank,
  getSummaryScore,
  getSummaryRank,
  getSummaryCoverage,
} from '@/lib/utils/scores'
import { geoIdToIso2 } from '@/lib/utils/iso-numeric'
import {
  PILLAR_CSS, PILLAR_HEX, PILLAR_MIN_HEX, PILLAR_LABEL,
  CSS, FONT, RAW,
} from '@/lib/tokens'
import { DisclaimerBar, IncompleteBadge, Tag, ConfidenceBadge, ScoreModeToggle } from '@/components/ui/primitives'
import { useYearSelection } from '@/hooks/useYearSelection'

// world-atlas countries TopoJSON (110m resolution, ~75KB)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Geography feature default/hover/press styles
const GEO_STYLE = {
  default: { outline: 'none', stroke: CSS.bg, strokeWidth: 0.4 },
  hover:   { outline: 'none', stroke: CSS.accentE, strokeWidth: 0.8 },
  pressed: { outline: 'none', stroke: CSS.accentE, strokeWidth: 0.8 },
}

interface Props {
  allSummaries: SummaryWithCountry[]
}

const PILLAR_OPTIONS: { key: Pillar; label: string }[] = [
  { key: 'ESG', label: `Overall ESG` },
  { key: 'E',   label: `🌿 ${PILLAR_LABEL.E}` },
  { key: 'S',   label: `👥 ${PILLAR_LABEL.S}` },
  { key: 'G',   label: `⚖️ ${PILLAR_LABEL.G}` },
]

function getScore(s: EsgSummary, pillar: Pillar, mode: ScoreMode): number | null {
  return getSummaryScore(s, pillar, mode)
}

function getRank(s: EsgSummary, pillar: Pillar, mode: ScoreMode): number | null {
  return getSummaryRank(s, pillar, mode)
}

interface TooltipState {
  x: number
  y: number
  name: string
  score: number | null
}

export default function WorldMap({ allSummaries }: Props) {
  const router = useRouter()

  const [pillar,   setPillar]   = useState<Pillar>('ESG')
  const [selected, setSelected] = useState<SummaryWithCountry | null>(null)
  const [tooltip,  setTooltip]  = useState<TooltipState | null>(null)
  const [scoreMode, setScoreMode] = useState<ScoreMode>('global')
  const [focusedIso2, setFocusedIso2] = useState<string | null>(null)

  // ── DEV-02: Year selector ──────────────────────────────────────────────────
  const { availableYears, selectedYear, setSelectedYear, yearSummaries } = useYearSelection(allSummaries)

  const iso2Map = useMemo(() => {
    const m = new Map<string, SummaryWithCountry>()
    for (const s of yearSummaries) {
      const iso2 = s.countries?.iso2
      if (iso2) m.set(iso2, s)
    }
    return m
  }, [yearSummaries])

  // Top 10 for selected pillar/year
  const top10 = useMemo(
    () =>
      [...yearSummaries]
        .filter((s) => getScore(s, pillar, scoreMode) != null)
        .sort((a, b) => (getScore(b, pillar, scoreMode) ?? -1) - (getScore(a, pillar, scoreMode) ?? -1))
        .slice(0, 10),
    [yearSummaries, pillar, scoreMode]
  )

  const orderedSummaries = useMemo(() => {
    return [...yearSummaries]
      .filter((s) => s.countries?.name && s.countries?.iso2)
      .sort((a, b) => (a.countries?.name ?? '').localeCompare(b.countries?.name ?? ''))
  }, [yearSummaries])

  const selectedIndex = useMemo(() => {
    if (!selected) return -1
    return orderedSummaries.findIndex((s) => s.country_id === selected.country_id)
  }, [orderedSummaries, selected])

  const canNavigate = selectedIndex >= 0 && orderedSummaries.length > 1
  const prevSummary = canNavigate
    ? orderedSummaries[(selectedIndex - 1 + orderedSummaries.length) % orderedSummaries.length]
    : null
  const nextSummary = canNavigate
    ? orderedSummaries[(selectedIndex + 1) % orderedSummaries.length]
    : null

  const total = yearSummaries.length
  const selectedInfo = selected?.countries?.country_info ?? null
  const selectedCapital = selectedInfo?.capital_city ?? null
  const selectedLanguages = selectedInfo?.official_languages ?? null

  // ── DEV-01: Geography colour lookup ───────────────────────────────────────
  const getFill = useCallback(
    (geoId: string): string => {
      const iso2 = geoIdToIso2(geoId)
      if (!iso2) return RAW.scoreNone
      const summary = iso2Map.get(iso2)
      if (!summary) return RAW.scoreNone
      return scoreToColor(getScore(summary, pillar, scoreMode), pillar)
    },
    [iso2Map, pillar, scoreMode]
  )

  const handleGeoClick = useCallback(
    (geoId: string) => {
      const iso2 = geoIdToIso2(geoId)
      if (!iso2) return
      const summary = iso2Map.get(iso2)
      if (!summary) return
      setSelected((prev) =>
        prev?.countries?.iso2 === iso2 ? null : summary
      )
    },
    [iso2Map]
  )

  const handleGeoFocus = useCallback(
    (geoId: string) => {
      const iso2 = geoIdToIso2(geoId)
      if (!iso2) return
      if (!iso2Map.get(iso2)) return
      setFocusedIso2(iso2)
    },
    [iso2Map]
  )

  const handleGeoBlur = useCallback(() => {
    setFocusedIso2(null)
  }, [])

  const handleGeoKeyDown = useCallback(
    (geoId: string, evt: React.KeyboardEvent) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault()
        handleGeoClick(geoId)
      }
    },
    [handleGeoClick]
  )

  const handleGeoMouseEnter = useCallback(
    (geoId: string, evt: React.MouseEvent) => {
      const iso2 = geoIdToIso2(geoId)
      if (!iso2) return
      const summary = iso2Map.get(iso2)
      if (!summary) return
      setTooltip({
        x: evt.clientX + 12,
        y: evt.clientY - 28,
        name:  summary.countries?.name ?? iso2,
        score: getScore(summary, pillar, scoreMode),
      })
    },
    [iso2Map, pillar, scoreMode]
  )

  const handleGeoMouseMove = useCallback((evt: React.MouseEvent) => {
    setTooltip((prev) =>
      prev ? { ...prev, x: evt.clientX + 12, y: evt.clientY - 28 } : null
    )
  }, [])

  const handleGeoMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('map-view-active')
    document.body.classList.add('map-view-active')
    return () => {
      document.documentElement.classList.remove('map-view-active')
      document.body.classList.remove('map-view-active')
    }
  }, [])

  useEffect(() => {
    if (!canNavigate) return
    const handler = (evt: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null
      const tag = active?.tagName
      if (active?.isContentEditable) return
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (evt.key === 'ArrowLeft' && prevSummary) {
        evt.preventDefault()
        setSelected(prevSummary)
      }
      if (evt.key === 'ArrowRight' && nextSummary) {
        evt.preventDefault()
        setSelected(nextSummary)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canNavigate, nextSummary, prevSummary])

  return (
    <div className="map-page" style={{ position: 'relative' }}>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <span style={{ color: CSS.text }}>{tooltip.name}</span>
          <span style={{ color: PILLAR_CSS[pillar], marginLeft: 8, fontWeight: 600 }}>
            {tooltip.score != null ? formatScore(tooltip.score, 1) : '—'}
          </span>
        </div>
      )}

      <div className="map-header">
        <div className="map-title-row">
          <h1 className="page-title" style={{ marginBottom: 0 }}>🦉 Hibou — Auditable ESG Scores</h1>
          {selectedYear ? <Tag>DATA YEAR {selectedYear}</Tag> : null}
        </div>
        <p className="page-subtitle">
          {scoreMode === 'peer' ? 'Peer-group' : 'Global'} percentiles · {total} countries with data ≤ {selectedYear}
        </p>
      </div>

      {/* ── Controls row ── */}
      <div className="map-controls">
        {/* Pillar toggle */}
        <div className="pillar-toggle" style={{ marginBottom: 0 }}>
          {PILLAR_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              className={`pill ${pillar === key ? `active-${key.toLowerCase()}` : ''}`}
              onClick={() => setPillar(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <ScoreModeToggle mode={scoreMode} onChange={setScoreMode} />

        {availableYears.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: CSS.textDim, letterSpacing: '1px' }}>
              YEAR
            </span>
            <select
              className="select-filter"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value))
                setSelected(null)
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="map-layout">
        {/* ── Main map area ── */}
        <div className="map-main">
          {/* ── Geographic choropleth map ── */}
          <div
            className="panel map-panel"
            style={{ overflow: 'hidden', background: CSS.mapBg }}
            onMouseMove={handleGeoMouseMove}
          >
            <ComposableMap
              projectionConfig={{ scale: 147, center: [0, 10] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup zoom={1.27} minZoom={0.8} maxZoom={6}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }: { geographies: Array<{ rsmKey: string; id: string }> }) =>
                    geographies.map((geo) => {
                      const iso2    = geoIdToIso2(geo.id)
                      const summary = iso2 ? iso2Map.get(iso2) : undefined
                      const fill    = getFill(geo.id)
                      const hasSummary = Boolean(summary)
                      const isSelected = selected?.countries?.iso2 === iso2
                      const isFocused = focusedIso2 === iso2
                      const score = summary ? getScore(summary, pillar, scoreMode) : null
                      const ariaLabel = summary
                        ? `${summary.countries?.name ?? iso2} ${pillar} score ${formatScore(score, 1)}. Press Enter to select.`
                        : `${iso2 ?? 'Country'}: no data`

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          role={hasSummary ? 'button' : 'img'}
                          tabIndex={hasSummary ? 0 : -1}
                          aria-label={ariaLabel}
                          aria-disabled={!hasSummary}
                          style={{
                            default: {
                              ...GEO_STYLE.default,
                              strokeWidth: isSelected ? 1.4 : (isFocused ? 1.1 : 0.4),
                              stroke: isSelected ? CSS.text : (isFocused ? CSS.textDim : CSS.bg),
                              strokeOpacity: isSelected || isFocused ? 0.9 : 1,
                              cursor: hasSummary ? 'pointer' : 'default',
                            },
                            hover: {
                              ...GEO_STYLE.hover,
                              cursor: hasSummary ? 'pointer' : 'default',
                            },
                            pressed: {
                              ...GEO_STYLE.pressed,
                              cursor: hasSummary ? 'pointer' : 'default',
                            },
                          }}
                          onClick={() => handleGeoClick(geo.id)}
                          onKeyDown={(evt: React.KeyboardEvent) => handleGeoKeyDown(geo.id, evt)}
                          onFocus={() => handleGeoFocus(geo.id)}
                          onBlur={handleGeoBlur}
                          onMouseEnter={(evt: React.MouseEvent) => handleGeoMouseEnter(geo.id, evt)}
                          onMouseLeave={handleGeoMouseLeave}
                        />
                      )
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>

          {/* Legend */}
          <div className="legend" style={{ marginTop: 10 }}>
            <span className="legend-label">Low (worse)</span>
            <div
              className="legend-bar"
              style={{
                background: `linear-gradient(to right, ${PILLAR_MIN_HEX[pillar]}, ${PILLAR_HEX[pillar]})`,
              }}
            />
            <span className="legend-label">High (better)</span>
            <span style={{ marginLeft: 12, fontSize: 10, letterSpacing: '1px', color: CSS.textDim }}>
              {pillar} SCORE · {selectedYear}
            </span>
            <span style={{ marginLeft: 8, fontSize: 10, color: CSS.textDim }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: RAW.scoreNone, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />
              No data
            </span>
          </div>

          <DisclaimerBar />
          <p className="map-methodology">
            Scores are percentiles (0–100) using the most recent data ≤ the selected year.
            Peer mode computes percentiles within income groups.
          </p>

          <p style={{ fontFamily: FONT.mono, fontSize: 10, color: CSS.textDim, marginTop: 6 }}>
            Click a country to inspect · Scroll / pinch to zoom · Drag to pan
          </p>
        </div>

        {/* ── Sidebar ── */}
        <div className="map-sidebar">
        {selected ? (
          <div className="country-card">
            <div className="country-card-header">
              <div className="country-card-headline">
                <div>
                  <div className="country-name">{selected.countries?.name}</div>
                  <div className="country-meta">
                    {selected.countries?.iso3} · {selected.countries?.region}
                  </div>
                  <div className="country-meta" style={{ marginTop: 2 }}>
                    {selected.countries?.income_group}
                  </div>
                  {(selectedCapital || selectedLanguages) && (
                    <div className="country-meta" style={{ marginTop: 2 }}>
                      Capital: {selectedCapital ?? '—'} · Languages: {selectedLanguages ?? '—'}
                    </div>
                  )}
                </div>
                {!selected.data_complete && <IncompleteBadge />}
                <ConfidenceBadge coverage={getSummaryCoverage(selected, 'ESG')} />
              </div>
            </div>

            <div className="score-grid">
              {(
                [
                  ['E',   'Environmental', getSummaryScore(selected, 'E', scoreMode),   getSummaryRank(selected, 'E', scoreMode)],
                  ['S',   'Social',        getSummaryScore(selected, 'S', scoreMode),   getSummaryRank(selected, 'S', scoreMode)],
                  ['G',   'Governance',    getSummaryScore(selected, 'G', scoreMode),   getSummaryRank(selected, 'G', scoreMode)],
                  ['ESG', 'Overall',       getSummaryScore(selected, 'ESG', scoreMode), getSummaryRank(selected, 'ESG', scoreMode)],
                ] as const
              ).map(([p, label, score, rank]) => (
                <div key={p} className="score-cell">
                  <div className="score-label">{label}</div>
                  <div className={`score-value score-${p.toLowerCase()}`}>
                    {formatScore(score, 1)}
                  </div>
                  <div className="score-rank">{formatRank(rank, total)}</div>
                </div>
              ))}
            </div>

            {selected.narrative && (
              <div className="narrative-block">
                <em>&ldquo;{selected.narrative}&rdquo;</em>
              </div>
            )}

            <button
              className="btn-profile"
              onClick={() => router.push(`/country/${selected.countries?.iso2}?year=${selectedYear}`)}
            >
              VIEW FULL PROFILE →
            </button>
            <div className="country-nav">
              <button
                className="country-nav-btn"
                type="button"
                onClick={() => prevSummary && setSelected(prevSummary)}
                disabled={!prevSummary}
                aria-label="Select previous country"
              >
                ← Prev
              </button>
              <button
                className="country-nav-btn"
                type="button"
                onClick={() => nextSummary && setSelected(nextSummary)}
                disabled={!nextSummary}
                aria-label="Select next country"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="country-card" style={{ padding: '24px 18px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌍</div>
              <div className="country-name" style={{ fontSize: 16, marginBottom: 8 }}>
                Select a Country
              </div>
              <p style={{ fontSize: 12, color: CSS.textDim, lineHeight: 1.6 }}>
                Click any country to see percentile scores, data years, and sources.
              </p>
            </div>

            <div className="section-divider" />

            <div
              className="panel-title"
              style={{ marginBottom: 10 }}
            >
              TOP 10 — {pillar} · {selectedYear} · {scoreMode.toUpperCase()}
            </div>
            {top10.map((s, i) => (
              <div
                key={s.country_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  marginBottom: 8, cursor: 'pointer',
                }}
                onClick={() => setSelected(s)}
              >
                <span style={{
                  fontFamily: FONT.mono, fontSize: 11,
                  color: CSS.textDim, minWidth: 20,
                }}>
                  #{i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>
                  {s.countries?.name}
                </span>
                <span style={{
                  fontFamily: FONT.mono, fontSize: 12,
                  fontWeight: 500, color: PILLAR_CSS[pillar],
                }}>
                  {formatScore(getScore(s, pillar, scoreMode), 1)}
                </span>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
