// components/ui/primitives.tsx
// Shared visual building blocks. No page logic. No hardcoded colors.
// All color values come from tokens.ts CSS variables.
'use client'

import type { Pillar, ScoreMode } from '@/types/hibou'
import { CSS, FONT, PILLAR_CSS, PILLAR_LABEL } from '@/lib/tokens'

// ── Panel ─────────────────────────────────────────────────────────────────────

export function Panel({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={`panel ${className}`} style={style}>{children}</div>
}

export function PanelHeader({
  title,
  right,
}: {
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="panel-header">
      <span className="panel-title">{title}</span>
      {right}
    </div>
  )
}

export function PanelBody({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return <div className="panel-body" style={style}>{children}</div>
}

// ── ScoreChip ─────────────────────────────────────────────────────────────────

export function ScoreChip({
  pillar,
  label,
  score,
  rank,
}: {
  pillar: Pillar
  label: string
  score: number | null
  rank?: number | null
}) {
  return (
    <div className="panel" style={{ padding: '10px 14px', textAlign: 'center', minWidth: 72 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim, letterSpacing: '1px', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT.serif, fontSize: 26, fontWeight: 700, color: PILLAR_CSS[pillar] }}>
        {score != null ? Math.round(score) : '–'}
      </div>
      {rank != null && (
        <div style={{ fontFamily: FONT.mono, fontSize: 9, color: CSS.textDim, marginTop: 2 }}>
          #{rank}
        </div>
      )}
    </div>
  )
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

export function ScoreBar({
  score,
  pillar = 'ESG',
  height = 4,
}: {
  score: number | null
  pillar?: Pillar
  height?: number
}) {
  return (
    <div style={{ height, background: CSS.border, borderRadius: 2, overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%',
        width: `${score ?? 0}%`,
        background: PILLAR_CSS[pillar],
        borderRadius: 2,
        transition: 'width 0.4s',
        opacity: 0.85,
      }} />
    </div>
  )
}

// ── PillarSectionHeader ───────────────────────────────────────────────────────

export function PillarSectionHeader({
  pillar,
  score,
}: {
  pillar: Pillar
  score: number | null
}) {
  return (
    <PanelHeader
      title={`${PILLAR_LABEL[pillar]} Indicators`}
      right={
        <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 700, color: PILLAR_CSS[pillar] }}>
          {score != null ? Math.round(score) : '–'}
        </span>
      }
    />
  )
}

// ── DisclaimerBar ─────────────────────────────────────────────────────────────

export function DisclaimerBar() {
  return (
    <div className="income-disclaimer">
      <strong>⚠ Income Bias:</strong> Scores reflect absolute performance vs all countries.
      Wealthier countries structurally score higher on most Social indicators.
      A low CO₂ score in a poor country reflects energy poverty, not environmental policy.
      Filter by income group for fair peer comparison.
    </div>
  )
}

// ── IncompleteBadge ───────────────────────────────────────────────────────────

export function IncompleteBadge() {
  return <span className="badge-incomplete">⚠ INCOMPLETE DATA</span>
}

// ── ConfidenceBadge ───────────────────────────────────────────────────────────

export function ConfidenceBadge({ coverage }: { coverage: number | null | undefined }) {
  if (coverage == null) return null
  const pct = Math.round(coverage * 100)
  const color = pct >= 85 ? CSS.accentE : pct >= 70 ? CSS.accentS : CSS.danger
  return <Tag color={color}>CONF {pct}%</Tag>
}

// ── LoadingDots ───────────────────────────────────────────────────────────────

export function LoadingDots() {
  return (
    <div className="loading-dots">
      <div className="dot" /><div className="dot" /><div className="dot" />
    </div>
  )
}

// ── MonoLabel — small uppercase mono label ────────────────────────────────────

export function MonoLabel({
  children,
  size = 10,
}: {
  children: React.ReactNode
  size?: number
}) {
  return (
    <span style={{
      fontFamily: FONT.mono,
      fontSize: size,
      color: CSS.textDim,
      letterSpacing: '1px',
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

// ── ScoreModeToggle — global vs peer ─────────────────────────────────────────

export function ScoreModeToggle({
  mode,
  onChange,
}: {
  mode: ScoreMode
  onChange: (mode: ScoreMode) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button
        className={`pill ${mode === 'global' ? 'active-esg' : ''}`}
        onClick={() => onChange('global')}
        type="button"
      >
        GLOBAL
      </button>
      <button
        className={`pill ${mode === 'peer' ? 'active-s' : ''}`}
        onClick={() => onChange('peer')}
        type="button"
      >
        PEER
      </button>
    </div>
  )
}

// ── Tag — small pill badge ────────────────────────────────────────────────────

export function Tag({
  children,
  color = CSS.textDim,
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <span style={{
      fontFamily: FONT.mono,
      fontSize: 9,
      color,
      background: `${color}18`,
      padding: '2px 6px',
      borderRadius: 3,
    }}>
      {children}
    </span>
  )
}
