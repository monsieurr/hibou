'use client'
// components/ui/IndicatorCard.tsx
// Expandable transparency card for a single indicator score.
// Clicking reveals the raw value, source, year, direction, and WB code.

import { useState, type ReactNode } from 'react'
import { PILLAR_CSS, CSS, FONT } from '@/lib/tokens'
import type { ScoreWithIndicator } from '@/types/hibou'

interface Props {
  score: ScoreWithIndicator
}

const PILLAR_CLASS: Record<string, string> = {
  E: 'code-e',
  S: 'code-s',
  G: 'code-g',
}


export default function IndicatorCard({ score }: Props) {
  const [open, setOpen] = useState(false)
  const ind = score.indicators
  if (!ind) return null

  const color = PILLAR_CSS[ind.pillar as keyof typeof PILLAR_CSS] ?? CSS.accent
  const normPct   = score.normalized != null ? Math.round(score.normalized * 100) : null
  const percentileInfo = normPct != null
    ? `Percentile score. Better than ${normPct}% of countries (global, same year).`
    : 'Percentile score unavailable.'

  return (
    <div className="indicator-row">
      <button
        className="indicator-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        type="button"
      >
        <span className={`indicator-code ${PILLAR_CLASS[ind.pillar]}`}>{ind.code}</span>

        <span className="indicator-name">{ind.name}</span>

        <span className="indicator-year">{score.year}</span>

        {normPct != null && (
          <div className="indicator-bar-wrap">
            <div
              className="indicator-bar-fill"
              style={{ width: `${normPct}%`, background: color, opacity: 0.75 }}
            />
          </div>
        )}

        <span className="indicator-score-val" style={{ color }}>
          {normPct ?? '–'}
        </span>

        <span className={`indicator-chevron${open ? ' open' : ''}`}>▶</span>
      </button>

      {open && (
        <dl className="indicator-detail">
          <DetailItem label="Raw Value"     value={score.raw_value != null ? `${score.raw_value} ${ind.unit ?? ''}`.trim() : '–'} />
          <DetailItem
            label={(
              <span className="detail-label-inline">
                Normalised
                <button
                  className="info-icon"
                  type="button"
                  aria-label={percentileInfo}
                  data-tooltip={percentileInfo}
                >
                  i
                </button>
              </span>
            )}
            value={normPct != null ? `${normPct} / 100` : '–'}
          />
          <DetailItem label="Source"        value={ind.source ?? score.data_source ?? '–'} />
          <DetailItem label="Data Year"     value={String(score.year)} />
          <DetailItem label="Direction"     value={ind.higher_is_better ? '↑ higher is better' : '↓ lower is better'} />
          <DetailItem label="WB Code"       value={ind.wb_code ?? '–'} mono />
          {ind.description && (
            <DetailItem label="Description" value={ind.description} span />
          )}
        </dl>
      )}
    </div>
  )
}

function DetailItem({
  label, value, mono = false, span = false,
}: {
  label: ReactNode
  value: ReactNode
  mono?: boolean
  span?: boolean
}) {
  return (
    <div className="detail-item" style={span ? { gridColumn: '1 / -1' } : undefined}>
      <dt className="detail-label">{label}</dt>
      <dd className="detail-value" style={mono ? { fontFamily: FONT.mono, fontSize: 10 } : undefined}>
        {value}
      </dd>
    </div>
  )
}
