'use client'
// components/profile/NarrativeCard.tsx
// Displays the precomputed AI narrative for a country.

import { Panel, PanelHeader, PanelBody } from '@/components/ui/primitives'
import { CSS, FONT } from '@/lib/tokens'

interface Props {
  narrative: string | null
  narrativeYear: number | null
}

export default function NarrativeCard({ narrative, narrativeYear }: Props) {
  return (
    <Panel>
      <PanelHeader
        title="AI Narrative"
        right={
          <span style={{
            fontFamily: FONT.mono, fontSize: 9,
            color: CSS.textDim, background: 'rgba(127,176,105,0.2)',
            padding: '2px 6px', borderRadius: 3,
          }}>
            LLM
          </span>
        }
      />
      <PanelBody>
        {narrative ? (
          <>
            <p style={{ fontSize: 13, fontStyle: 'italic', color: CSS.text, lineHeight: 1.7, marginBottom: 6 }}>
              &ldquo;{narrative}&rdquo;
            </p>
            <p style={{ fontFamily: FONT.mono, fontSize: 10, color: CSS.textDim }}>
              Based on the most recent data{narrativeYear ? ` (year ${narrativeYear})` : ''} · applies to all years.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 12, color: CSS.textDim }}>
            No narrative stored yet. Run <code>python generate_narratives.py</code> to precompute it.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}
