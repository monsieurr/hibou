// lib/tokens.ts
// Design tokens mirrored from globals.css for use in TS.

import type { Pillar } from '@/types/hibou'

// ── Raw hex values (mirror of :root in globals.css) ───────────────────────────
export const RAW = {
  bg:       '#0d0a08',
  surface:  '#15100d',
  panel:    '#211814',
  mapBg:    '#211814',
  border:   '#35281f',
  accentE:  '#7fb069',
  accentS:  '#e6c84f',
  accentG:  '#8c6bd1',
  accent:   '#d9a441',
  muted:    '#6f5b4a',
  text:     '#eadbc7',
  textDim:  '#b59a82',
  danger:   '#e26d5c',
  scoreNone:'#35281f',  // no-data tile
} as const

// ── CSS variable references (use in inline styles) ────────────────────────────
export const CSS = {
  bg:       'var(--bg)',
  surface:  'var(--surface)',
  panel:    'var(--panel)',
  mapBg:    'var(--map-bg)',
  border:   'var(--border)',
  accentE:  'var(--accent-e)',
  accentS:  'var(--accent-s)',
  accentG:  'var(--accent-g)',
  accent:   'var(--accent)',
  muted:    'var(--muted)',
  text:     'var(--text)',
  textDim:  'var(--text-dim)',
  danger:   'var(--danger)',
} as const

// ── Per-pillar accent colors ───────────────────────────────────────────────────

/** CSS variable string per pillar — safe for inline style={{ color }} */
export const PILLAR_CSS: Record<Pillar, string> = {
  E:   CSS.accentE,
  S:   CSS.accentS,
  G:   CSS.accentG,
  ESG: CSS.accent,
}

/** Raw hex per pillar — used for canvas / SVG / D3 color interpolation */
export const PILLAR_HEX: Record<Pillar, string> = {
  E:   RAW.accentE,
  S:   RAW.accentS,
  G:   RAW.accentG,
  ESG: RAW.accent,
}

const LOW_SCORE_HEX = '#8a1c1c'

/** Low-end hue per pillar for 0→100 gradients (shared red for “low” values). */
export const PILLAR_MIN_HEX: Record<Pillar, string> = {
  E:   LOW_SCORE_HEX,
  S:   LOW_SCORE_HEX,
  G:   LOW_SCORE_HEX,
  ESG: LOW_SCORE_HEX,
}

// ── Per-pillar labels ──────────────────────────────────────────────────────────
export const PILLAR_LABEL: Record<Pillar, string> = {
  E:   'Environmental',
  S:   'Social',
  G:   'Governance',
  ESG: 'Overall ESG',
}

// ── Typography ────────────────────────────────────────────────────────────────
export const FONT = {
  serif: 'var(--font-heading)',
  mono:  'var(--font-mono)',
  sans:  'var(--font-body)',
} as const

// ── Spacing scale (px) ────────────────────────────────────────────────────────
export const SPACE = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
} as const

// ── Border radius ─────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   4,
  md:   6,
  lg:   10,
  pill: 20,
} as const
