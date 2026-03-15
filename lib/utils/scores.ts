// lib/utils/scores.ts
// Pure score → display helpers.
// Color values come from tokens.ts : no hex strings here.

import type { EsgSummary, Pillar, ScoreMode } from '@/types/hibou'
import { RAW, PILLAR_HEX, PILLAR_MIN_HEX, PILLAR_CSS, PILLAR_LABEL } from '@/lib/tokens'

// Re-export so callers can import everything from one place
export { PILLAR_CSS as PILLAR_VAR, PILLAR_LABEL }

/** Linear interpolate between two hex colors. */
function lerpHex(from: string, to: string, t: number): string {
  const parse = (h: string) => ({
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  })
  const a = parse(from), b = parse(to)
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bl = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r},${g},${bl})`
}

/**
 * Map a 0–100 score to an interpolated RGB color for the given pillar.
 * Returns a neutral tile color for null/undefined scores.
 */
export function scoreToColor(
  score: number | null | undefined,
  pillar: Pillar = 'ESG'
): string {
  if (score == null) return RAW.scoreNone
  const t = Math.max(0, Math.min(100, score)) / 100
  return lerpHex(PILLAR_MIN_HEX[pillar], PILLAR_HEX[pillar], t)
}

/**
 * Format a score for display.
 * @param decimals  Decimal places : 0 gives an integer string (default).
 */
export function formatScore(
  score: number | null | undefined,
  decimals = 0
): string {
  if (score == null) return 'N/A'
  return decimals > 0 ? score.toFixed(decimals) : Math.round(score).toString()
}

/** Format a rank as "#12 / 214" or ":". */
export function formatRank(
  rank: number | null | undefined,
  total = 214
): string {
  if (rank == null) return ':'
  return `#${rank} / ${total}`
}

export function getSummaryScore(
  summary: EsgSummary,
  pillar: Pillar,
  mode: ScoreMode
): number | null {
  if (mode === 'peer') {
    if (pillar === 'E') return summary.e_score_peer
    if (pillar === 'S') return summary.s_score_peer
    if (pillar === 'G') return summary.g_score_peer
    return summary.esg_score_peer
  }
  if (pillar === 'E') return summary.e_score
  if (pillar === 'S') return summary.s_score
  if (pillar === 'G') return summary.g_score
  return summary.esg_score
}

export function getSummaryRank(
  summary: EsgSummary,
  pillar: Pillar,
  mode: ScoreMode
): number | null {
  if (mode === 'peer') {
    if (pillar === 'E') return summary.e_rank_peer
    if (pillar === 'S') return summary.s_rank_peer
    if (pillar === 'G') return summary.g_rank_peer
    return summary.esg_rank_peer
  }
  if (pillar === 'E') return summary.e_rank
  if (pillar === 'S') return summary.s_rank
  if (pillar === 'G') return summary.g_rank
  return summary.esg_rank
}

export function getSummaryCoverage(
  summary: EsgSummary,
  pillar: Pillar
): number | null {
  if (pillar === 'E') return summary.e_coverage
  if (pillar === 'S') return summary.s_coverage
  if (pillar === 'G') return summary.g_coverage
  return summary.esg_coverage
}
