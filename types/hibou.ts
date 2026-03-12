// types/hibou.ts
// Shared TypeScript interfaces matching the Hibou DB schema.
// These can also be auto-generated from Supabase:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export interface Country {
  id: number;
  iso2: string;
  iso3: string;
  name: string;
  region: string | null;
  income_group: string | null;
  lat: number | null;
  lng: number | null;
  country_info?: CountryInfo | null;
}

export interface Indicator {
  id: number;
  code: string;
  wb_code: string | null;
  name: string;
  pillar: "E" | "S" | "G";
  unit: string | null;
  source: string | null;
  description: string | null;
  higher_is_better: boolean;
  is_active: boolean;
}

export interface Score {
  id: number;
  country_id: number;
  indicator_id: number;
  year: number;
  raw_value: number | null;
  normalized: number | null;
  data_source: string | null;
}

export interface EsgSummary {
  id: number;
  country_id: number;
  year: number;
  e_score: number | null;
  s_score: number | null;
  g_score: number | null;
  esg_score: number | null;
  e_score_peer: number | null;
  s_score_peer: number | null;
  g_score_peer: number | null;
  esg_score_peer: number | null;
  e_indicators_count: number | null;
  s_indicators_count: number | null;
  g_indicators_count: number | null;
  e_coverage: number | null;
  s_coverage: number | null;
  g_coverage: number | null;
  esg_coverage: number | null;
  e_rank: number | null;
  s_rank: number | null;
  g_rank: number | null;
  esg_rank: number | null;
  e_rank_peer: number | null;
  s_rank_peer: number | null;
  g_rank_peer: number | null;
  esg_rank_peer: number | null;
  data_complete: boolean;
  narrative: string | null;
}

export interface SummaryWithCountry extends EsgSummary {
  // Supabase join: null when the foreign key references a row that doesn't exist.
  // Components already guard with optional chaining (s.countries?.iso2); this
  // type makes that nullability explicit rather than hiding it.
  countries: Country | null;
}

export interface ScoreWithIndicator extends Score {
  // Supabase join: null when the indicator row is missing or the join fails.
  // IndicatorCard already guards with: if (!ind) return null
  indicators: Indicator | null;
}

export interface CountryContext {
  country_id: number;
  gdp_per_capita: string | null;
  main_industries: string | null;
  climate_zone: string | null;
  esg_context: string | null;
  updated_at: string | null;
}

export interface CountryInfo {
  country_id: number;
  capital_city: string | null;
  official_languages: string | null;
  area_km2: number | null;
  source: string | null;
  updated_at: string | null;
}

export interface CountryStat {
  country_id: number;
  year: number;
  gdp_usd: number | null;
  population: number | null;
  gdp_per_capita: number | null;
  source: string | null;
}

export type Pillar = "E" | "S" | "G" | "ESG";
export type ScoreMode = "global" | "peer";

export interface PillarScores {
  e: number | null;
  s: number | null;
  g: number | null;
  esg: number | null;
}

export interface RadarDataPoint {
  axis: string;
  score: number;
}
