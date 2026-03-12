// types/supabase.ts
// Auto-generated from the Hibou DB schema.
// To regenerate after schema changes:
//   npm run db:types   (requires SUPABASE_PROJECT_ID in .env.local)
//
// This file is committed so the app builds without needing a live Supabase connection.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      countries: {
        Row: {
          id: number
          iso2: string
          iso3: string
          name: string
          region: string | null
          income_group: string | null
          lat: number | null
          lng: number | null
        }
        Insert: {
          id?: number
          iso2: string
          iso3: string
          name: string
          region?: string | null
          income_group?: string | null
          lat?: number | null
          lng?: number | null
        }
        Update: {
          id?: number
          iso2?: string
          iso3?: string
          name?: string
          region?: string | null
          income_group?: string | null
          lat?: number | null
          lng?: number | null
        }
      }
      indicators: {
        Row: {
          id: number
          code: string
          wb_code: string | null
          name: string
          pillar: 'E' | 'S' | 'G'
          unit: string | null
          source: string | null
          description: string | null
          higher_is_better: boolean
          is_active: boolean
        }
        Insert: {
          id?: number
          code: string
          wb_code?: string | null
          name: string
          pillar: 'E' | 'S' | 'G'
          unit?: string | null
          source?: string | null
          description?: string | null
          higher_is_better?: boolean
          is_active?: boolean
        }
        Update: {
          id?: number
          code?: string
          wb_code?: string | null
          name?: string
          pillar?: 'E' | 'S' | 'G'
          unit?: string | null
          source?: string | null
          description?: string | null
          higher_is_better?: boolean
          is_active?: boolean
        }
      }
      scores: {
        Row: {
          id: number
          country_id: number
          indicator_id: number
          year: number
          raw_value: number | null
          normalized: number | null
          data_source: string | null
        }
        Insert: {
          id?: number
          country_id: number
          indicator_id: number
          year: number
          raw_value?: number | null
          normalized?: number | null
          data_source?: string | null
        }
        Update: {
          id?: number
          country_id?: number
          indicator_id?: number
          year?: number
          raw_value?: number | null
          normalized?: number | null
          data_source?: string | null
        }
      }
      esg_summary: {
        Row: {
          id: number
          country_id: number
          year: number
          e_score: number | null
          e_indicators_count: number | null
          s_score: number | null
          s_indicators_count: number | null
          g_score: number | null
          g_indicators_count: number | null
          esg_score: number | null
          e_rank: number | null
          s_rank: number | null
          g_rank: number | null
          esg_rank: number | null
          data_complete: boolean
          narrative: string | null
        }
        Insert: {
          id?: number
          country_id: number
          year: number
          e_score?: number | null
          e_indicators_count?: number | null
          s_score?: number | null
          s_indicators_count?: number | null
          g_score?: number | null
          g_indicators_count?: number | null
          esg_score?: number | null
          e_rank?: number | null
          s_rank?: number | null
          g_rank?: number | null
          esg_rank?: number | null
          data_complete?: boolean
          narrative?: string | null
        }
        Update: {
          id?: number
          country_id?: number
          year?: number
          e_score?: number | null
          e_indicators_count?: number | null
          s_score?: number | null
          s_indicators_count?: number | null
          g_score?: number | null
          g_indicators_count?: number | null
          esg_score?: number | null
          e_rank?: number | null
          s_rank?: number | null
          g_rank?: number | null
          esg_rank?: number | null
          data_complete?: boolean
          narrative?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience row types
export type CountryRow    = Database['public']['Tables']['countries']['Row']
export type IndicatorRow  = Database['public']['Tables']['indicators']['Row']
export type ScoreRow      = Database['public']['Tables']['scores']['Row']
export type EsgSummaryRow = Database['public']['Tables']['esg_summary']['Row']
