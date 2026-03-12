// components/charts/EsgCharts.tsx
// Recharts chart components. Colors sourced from tokens — no hardcoded values.
'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import type { RadarDataPoint } from '@/types/hibou'
import { CSS, FONT, PILLAR_CSS } from '@/lib/tokens'

// ── EsgRadar — single country ─────────────────────────────────────────────────

interface EsgRadarProps {
  data: RadarDataPoint[]
  color?: string
  height?: number
}

export function EsgRadar({
  data,
  color = PILLAR_CSS.E,
  height = 260,
}: EsgRadarProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke={CSS.border} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: CSS.textDim, fontSize: 11, fontFamily: FONT.mono }}
          />
          <Radar
            dataKey="score"
            stroke={color}
            fill={color}
            fillOpacity={0.18}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── CompareRadar — dual-country overlay ───────────────────────────────────────

interface CompareRadarEntry { axis: string; a: number; b: number }

interface CompareRadarProps {
  data: CompareRadarEntry[]
  nameA: string
  nameB: string
  height?: number
}

const TooltipStyle = {
  background: CSS.panel,
  border: `1px solid ${CSS.border}`,
  borderRadius: 6,
  fontSize: 11,
}

export function CompareRadar({ data, nameA, nameB, height = 280 }: CompareRadarProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke={CSS.border} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: CSS.textDim, fontSize: 10, fontFamily: FONT.mono }}
          />
          <Radar name={nameA} dataKey="a" stroke={PILLAR_CSS.E} fill={PILLAR_CSS.E} fillOpacity={0.15} strokeWidth={2} />
          <Radar name={nameB} dataKey="b" stroke={PILLAR_CSS.S} fill={PILLAR_CSS.S} fillOpacity={0.12} strokeWidth={2} />
          <Tooltip contentStyle={TooltipStyle} labelStyle={{ color: CSS.text, fontFamily: FONT.mono }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── PillarBar ─────────────────────────────────────────────────────────────────

interface PillarScore { name: string; score: number; fill: string }

const BarTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: PillarScore }[] }) => {
  if (!active || !payload?.[0]) return null
  return (
    <div style={{ ...TooltipStyle, padding: '6px 10px', fontFamily: FONT.mono, color: CSS.text }}>
      {payload[0].payload.name}: {payload[0].payload.score.toFixed(1)}
    </div>
  )
}

export function PillarBar({ data, height = 120 }: { data: PillarScore[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: CSS.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: CSS.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<BarTooltip />} />
          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
