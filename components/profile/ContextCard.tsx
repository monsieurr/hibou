'use client'
// components/profile/ContextCard.tsx
// Country Context Card.
// Context is precomputed during ingestion and stored in `country_context`.

import type { Country, CountryContext, EsgSummary } from '@/types/hibou'
import { Panel, PanelHeader, PanelBody } from '@/components/ui/primitives'
import { CSS, FONT, RAW } from '@/lib/tokens'

interface Props {
  country: Country
  summary: EsgSummary
  context: CountryContext | null
  dataYearLabel: string
}

// ── Static row: always visible, sourced from DB ───────────────────────────────
function StaticRow({ label, value }: { label: string; value: string }) {
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

// ── Context row: stored in DB ────────────────────────────────────────────────
function ContextRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start',
      borderLeft: `2px solid ${accent ?? CSS.border}`,
      paddingLeft: 10,
    }}>
      <span style={{
        fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim,
        letterSpacing: '0.8px', textTransform: 'uppercase',
        minWidth: 98, paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: CSS.text, lineHeight: 1.4 }}>{value}</span>
    </div>
  )
}

export default function ContextCard({ country, summary, context, dataYearLabel }: Props) {
  return (
    <Panel>
      <PanelHeader
        title="Country Context"
        right={
          <span style={{
            fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim,
            background: 'rgba(140,107,209,0.18)',
            padding: '2px 6px', borderRadius: 3,
          }}>
            CONTEXT
          </span>
        }
      />
      <PanelBody>

        {/* Static fields : always visible */}
        <div style={{ marginBottom: 12 }}>
          <StaticRow label="ISO Code"     value={`${country.iso2} / ${country.iso3}`} />
          <StaticRow label="Region"       value={country.region       ?? ':'} />
          <StaticRow label="Income Group" value={country.income_group ?? ':'} />
          <StaticRow label="Score Year"   value={String(summary.year)} />
          <StaticRow label="Data Years"   value={dataYearLabel} />
        </div>

        <div style={{ height: 1, background: CSS.border, margin: '12px 0' }} />

        {context ? (
          <div style={{ marginBottom: 10 }}>
            <ContextRow label="GDP / Capita"  value={context.gdp_per_capita ?? ':'}  accent={RAW.accentS} />
            <ContextRow label="Industries"    value={context.main_industries ?? ':'} accent={RAW.accentE} />
            <ContextRow label="Climate Zone"  value={context.climate_zone ?? ':'}    accent={RAW.accentE} />
            {context.esg_context && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                background: 'rgba(140,107,209,0.08)',
                border: '1px solid rgba(140,107,209,0.25)',
                borderRadius: 5,
                fontSize: 12,
                color: CSS.textDim,
                fontStyle: 'italic',
                lineHeight: 1.6,
              }}>
                {context.esg_context}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: CSS.textDim, marginBottom: 10, lineHeight: 1.6 }}>
            No context stored yet. Run <code>python generate_context.py</code> to precompute it.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}
