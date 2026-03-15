// lib/data/repository.ts
// Server-side data repository for all Supabase queries.

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  Country,
  CountryContext,
  CountryInfo,
  CountryStat,
  EsgSummary,
  SummaryWithCountry,
  ScoreWithIndicator,
} from '@/types/hibou'

// ── Shared select fragments ───────────────────────────────────────────────────

const SUMMARY_FIELDS = `
  id, country_id, year,
  e_score, s_score, g_score, esg_score,
  e_score_peer, s_score_peer, g_score_peer, esg_score_peer,
  e_rank,  s_rank,  g_rank,  esg_rank,
  e_rank_peer, s_rank_peer, g_rank_peer, esg_rank_peer,
  e_indicators_count, s_indicators_count, g_indicators_count,
  e_coverage, s_coverage, g_coverage, esg_coverage,
  data_complete, narrative
` as const

const COUNTRY_INFO_FIELDS = `
  country_id, capital_city, official_languages, area_km2, source, updated_at
` as const

const COUNTRY_FIELDS = `
  id, iso2, iso3, name, region, income_group, lat, lng,
  country_info (${COUNTRY_INFO_FIELDS})
` as const

const SCORE_FIELDS = `
  id, country_id, indicator_id, year, raw_value, normalized, data_source,
  indicators (
    id, code, wb_code, name, pillar, unit, source, description, higher_is_better
  )
` as const

type CountryRow = Omit<Country, 'country_info'> & {
  country_info?: CountryInfo | CountryInfo[] | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSovereignCountry(country: Country | null | undefined): boolean {
  if (!country) return false
  if (!country.region || !country.income_group) return false
  if (!country.iso2 || country.iso2.length !== 2) return false
  if (!/^[A-Z]{2}$/i.test(country.iso2)) return false
  return true
}

/** Keep only the most recent year per country from a flat list of summaries. */
function dedupeLatestYear(rows: SummaryWithCountry[]): SummaryWithCountry[] {
  const seen = new Map<number, SummaryWithCountry>()
  for (const row of rows) {
    if (!isSovereignCountry(row.countries)) continue
    const existing = seen.get(row.country_id)
    if (!existing || row.year > existing.year) seen.set(row.country_id, row)
  }
  return Array.from(seen.values())
}

function normalizeCountryInfo(country: CountryRow | null | undefined): Country | null | undefined {
  if (!country) return country
  const rawInfo = (country as { country_info?: unknown }).country_info
  const normalized = Array.isArray(rawInfo)
    ? (rawInfo[0] ?? null)
    : (rawInfo ?? null)
  return { ...country, country_info: normalized as CountryInfo | null }
}

function normalizeSummaries(rows: SummaryWithCountry[]): SummaryWithCountry[] {
  return rows.map((row) => ({
    ...row,
    countries: normalizeCountryInfo(row.countries as CountryRow | null) as Country | null,
  }))
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch the latest ESG summary for every country.
 * Used by: World Map, Rankings, Compare pages.
 */
export const getAllSummaries = cache(async (): Promise<SummaryWithCountry[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('esg_summary')
    .select(`${SUMMARY_FIELDS}, countries (${COUNTRY_FIELDS})`)
    .order('year', { ascending: false })

  if (error) throw new Error(`getAllSummaries: ${error.message}`)

  return dedupeLatestYear(
    normalizeSummaries((data ?? []) as unknown as SummaryWithCountry[])
  )
})

/**
 * Fetch the latest ESG summary for a single country by ISO2 code.
 * Returns null if the country or its summary does not exist.
 */
export const getSummaryByIso2 = cache(async (
  iso2: string
): Promise<{ country: Country; summary: EsgSummary } | null> => {
  const supabase = await createClient()

  const { data: country } = await supabase
    .from('countries')
    .select(COUNTRY_FIELDS)
    .eq('iso2', iso2.toUpperCase())
    .single()

  if (!country) return null
  const normalizedCountry = normalizeCountryInfo(country as CountryRow)
  if (!isSovereignCountry(normalizedCountry as Country)) return null

  const { data: summary } = await supabase
    .from('esg_summary')
    .select(SUMMARY_FIELDS)
    .eq('country_id', country.id)
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!summary) return null

  return { country: normalizedCountry as Country, summary: summary as EsgSummary }
})

/**
 * Fetch all ESG summaries for a single country by ISO2 code (all years).
 */
export const getSummariesByIso2 = cache(async (
  iso2: string
): Promise<{ country: Country; summaries: EsgSummary[] } | null> => {
  const supabase = await createClient()

  const { data: country } = await supabase
    .from('countries')
    .select(COUNTRY_FIELDS)
    .eq('iso2', iso2.toUpperCase())
    .single()

  if (!country) return null
  const normalizedCountry = normalizeCountryInfo(country as CountryRow)
  if (!isSovereignCountry(normalizedCountry as Country)) return null

  const { data: summaries } = await supabase
    .from('esg_summary')
    .select(SUMMARY_FIELDS)
    .eq('country_id', country.id)
    .order('year', { ascending: false })

  if (!summaries || summaries.length === 0) return null

  return { country: normalizedCountry as Country, summaries: summaries as EsgSummary[] }
})

/**
 * Fetch the latest indicator scores for a country as of a given year.
 * (Uses most recent value per indicator with year <= target year.)
 * Used by: Country Profile page.
 */
export const getScoresByCountryYear = cache(async (
  countryId: number,
  year: number
): Promise<ScoreWithIndicator[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('scores')
    .select(SCORE_FIELDS)
    .eq('country_id', countryId)
    .lte('year', year)
    .order('indicator_id', { ascending: true })
    .order('year', { ascending: false })

  if (error) throw new Error(`getScoresByCountryYear: ${error.message}`)

  const rows = (data ?? []) as unknown as ScoreWithIndicator[]
  const latestByIndicator = new Map<number, ScoreWithIndicator>()

  for (const row of rows) {
    if (!latestByIndicator.has(row.indicator_id)) {
      latestByIndicator.set(row.indicator_id, row)
    }
  }

  return Array.from(latestByIndicator.values()).sort(
    (a, b) => a.indicator_id - b.indicator_id
  )
})

/**
 * Fetch stored country context for a given country.
 * Returns null when no context is stored yet.
 */
export const getCountryContext = cache(async (
  countryId: number
): Promise<CountryContext | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('country_context')
    .select('country_id, gdp_per_capita, main_industries, climate_zone, esg_context, updated_at')
    .eq('country_id', countryId)
    .maybeSingle()

  if (error) throw new Error(`getCountryContext: ${error.message}`)

  return (data ?? null) as CountryContext | null
})

/**
 * Fetch static country info (capital, languages, area).
 */
export const getCountryInfo = cache(async (
  countryId: number
): Promise<CountryInfo | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('country_info')
    .select('country_id, capital_city, official_languages, area_km2, source, updated_at')
    .eq('country_id', countryId)
    .maybeSingle()

  if (error) throw new Error(`getCountryInfo: ${error.message}`)

  return (data ?? null) as CountryInfo | null
})

/**
 * Fetch latest country stats <= the selected year.
 */
export const getCountryStatsAsOf = cache(async (
  countryId: number,
  year: number
): Promise<CountryStat | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('country_stats')
    .select('country_id, year, gdp_usd, population, gdp_per_capita, source')
    .eq('country_id', countryId)
    .lte('year', year)
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getCountryStatsAsOf: ${error.message}`)

  return (data ?? null) as CountryStat | null
})

/**
 * Fetch the latest ESG summaries sorted by ESG rank.
 * Used by: Rankings page (pre-sorted server-side).
 */
export const getRankedSummaries = cache(async (): Promise<SummaryWithCountry[]> => {
  const summaries = await getAllSummaries()
  return summaries
    .filter((s) => isSovereignCountry(s.countries))
    .sort((a, b) => (a.esg_rank ?? 9999) - (b.esg_rank ?? 9999))
})

/**
 * Fetch ALL ESG summaries across ALL years (no deduplication).
 * Used by: World Map year selector : client derives available years and filters.
 */
export const getAllSummariesAllYears = cache(async (): Promise<SummaryWithCountry[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('esg_summary')
    .select(`${SUMMARY_FIELDS}, countries (${COUNTRY_FIELDS})`)
    .order('year', { ascending: false })

  if (error) throw new Error(`getAllSummariesAllYears: ${error.message}`)

  return normalizeSummaries((data ?? []) as unknown as SummaryWithCountry[])
    .filter((s) => isSovereignCountry(s.countries))
})
