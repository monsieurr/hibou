-- Hibou ESG : Initial Schema
-- Run this in your Supabase project → SQL Editor
-- All tables are append-only by year. No schema changes needed to add new indicators or years.

-- ─── 1. countries ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS countries (
  id           SERIAL PRIMARY KEY,
  iso2         CHAR(2)      UNIQUE NOT NULL,  -- "FR"
  iso3         CHAR(3)      UNIQUE NOT NULL,  -- "FRA"
  name         VARCHAR(100) NOT NULL,          -- "France"
  region       VARCHAR(100),                   -- "Europe & Central Asia"
  income_group VARCHAR(50),                    -- "High income"
  lat          DECIMAL(8,4),
  lng          DECIMAL(8,4)
);

-- ─── 2. indicators ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS indicators (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(10)  UNIQUE NOT NULL, -- "E1"
  wb_code          VARCHAR(60),                  -- "EN.ATM.CO2E.PC"
  name             VARCHAR(200) NOT NULL,
  pillar           CHAR(1)      NOT NULL CHECK (pillar IN ('E', 'S', 'G')),
  unit             VARCHAR(50),
  source           VARCHAR(100),
  description      TEXT,
  higher_is_better BOOLEAN      NOT NULL DEFAULT true,
  is_active        BOOLEAN      NOT NULL DEFAULT true
);

-- ─── 3. scores (core fact table) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
  id           SERIAL PRIMARY KEY,
  country_id   INT      NOT NULL REFERENCES countries(id),
  indicator_id INT      NOT NULL REFERENCES indicators(id),
  year         SMALLINT NOT NULL,
  raw_value    DECIMAL(14,4),  -- original value from source, never modified
  normalized   DECIMAL(5,4),   -- 0.0–1.0, recomputable from raw_value
  data_source  VARCHAR(200),   -- source URL or dataset version
  UNIQUE(country_id, indicator_id, year)
);

CREATE INDEX IF NOT EXISTS idx_scores_country    ON scores(country_id);
CREATE INDEX IF NOT EXISTS idx_scores_indicator  ON scores(indicator_id);
CREATE INDEX IF NOT EXISTS idx_scores_year       ON scores(year);
CREATE INDEX IF NOT EXISTS idx_scores_composite  ON scores(country_id, year);

-- ─── 4. esg_summary (pre-computed, regenerable) ───────────────────────────────
CREATE TABLE IF NOT EXISTS esg_summary (
  id                   SERIAL PRIMARY KEY,
  country_id           INT      NOT NULL REFERENCES countries(id),
  year                 SMALLINT NOT NULL,

  -- Pillar scores (0–100) and indicator coverage counts
  e_score              DECIMAL(5,2),   e_indicators_count SMALLINT,
  s_score              DECIMAL(5,2),   s_indicators_count SMALLINT,
  g_score              DECIMAL(5,2),   g_indicators_count SMALLINT,
  esg_score            DECIMAL(5,2),
  e_score_peer         DECIMAL(5,2),
  s_score_peer         DECIMAL(5,2),
  g_score_peer         DECIMAL(5,2),
  esg_score_peer       DECIMAL(5,2),

  -- Coverage ratios (0–1)
  e_coverage           DECIMAL(5,4),
  s_coverage           DECIMAL(5,4),
  g_coverage           DECIMAL(5,4),
  esg_coverage         DECIMAL(5,4),

  -- Rankings among all countries for this year
  e_rank               SMALLINT,
  s_rank               SMALLINT,
  g_rank               SMALLINT,
  esg_rank             SMALLINT,
  e_rank_peer          SMALLINT,
  s_rank_peer          SMALLINT,
  g_rank_peer          SMALLINT,
  esg_rank_peer        SMALLINT,

  -- Data quality flag: true if >= 7/9 indicators available per pillar
  data_complete        BOOLEAN DEFAULT false,

  -- AI-generated one-liner, stored at ingestion time
  narrative            VARCHAR(220),

  UNIQUE(country_id, year)
);

CREATE INDEX IF NOT EXISTS idx_summary_year     ON esg_summary(year);
CREATE INDEX IF NOT EXISTS idx_summary_esg_rank ON esg_summary(esg_rank);

-- Ensure new columns exist when re-running this migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'esg_summary'
  ) THEN
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS e_score_peer DECIMAL(5,2);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS s_score_peer DECIMAL(5,2);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS g_score_peer DECIMAL(5,2);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS esg_score_peer DECIMAL(5,2);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS e_coverage DECIMAL(5,4);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS s_coverage DECIMAL(5,4);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS g_coverage DECIMAL(5,4);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS esg_coverage DECIMAL(5,4);
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS e_rank_peer SMALLINT;
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS s_rank_peer SMALLINT;
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS g_rank_peer SMALLINT;
    ALTER TABLE esg_summary ADD COLUMN IF NOT EXISTS esg_rank_peer SMALLINT;
  END IF;
END $$;

-- ─── 4b. country_context (LLM-generated context, per country) ───────────────
CREATE TABLE IF NOT EXISTS country_context (
  country_id     INT PRIMARY KEY REFERENCES countries(id),
  gdp_per_capita VARCHAR(80),
  main_industries VARCHAR(120),
  climate_zone   VARCHAR(80),
  esg_context    VARCHAR(220),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── 4c. country_info (static country metadata) ─────────────────────────────
CREATE TABLE IF NOT EXISTS country_info (
  country_id          INT PRIMARY KEY REFERENCES countries(id),
  capital_city        VARCHAR(80),
  official_languages  VARCHAR(120),
  area_km2            NUMERIC,
  source              VARCHAR(80),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── 4d. country_stats (yearly macro indicators) ────────────────────────────
CREATE TABLE IF NOT EXISTS country_stats (
  country_id      INT REFERENCES countries(id),
  year            INT NOT NULL,
  gdp_usd         NUMERIC,
  population      BIGINT,
  gdp_per_capita  NUMERIC,
  source          VARCHAR(80),
  PRIMARY KEY (country_id, year)
);

CREATE INDEX IF NOT EXISTS idx_country_stats_year ON country_stats(year);

-- ─── 5. Row Level Security (public read, no public writes) ───────────────────
ALTER TABLE countries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicators  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'countries' AND policyname = 'public_read_countries'
  ) THEN
    CREATE POLICY public_read_countries ON countries FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'indicators' AND policyname = 'public_read_indicators'
  ) THEN
    CREATE POLICY public_read_indicators ON indicators FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scores' AND policyname = 'public_read_scores'
  ) THEN
    CREATE POLICY public_read_scores ON scores FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'esg_summary' AND policyname = 'public_read_esg_summary'
  ) THEN
    CREATE POLICY public_read_esg_summary ON esg_summary FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'country_context' AND policyname = 'public_read_country_context'
  ) THEN
    CREATE POLICY public_read_country_context ON country_context FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'country_info' AND policyname = 'public_read_country_info'
  ) THEN
    CREATE POLICY public_read_country_info ON country_info FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'country_stats' AND policyname = 'public_read_country_stats'
  ) THEN
    CREATE POLICY public_read_country_stats ON country_stats FOR SELECT USING (true);
  END IF;
END $$;

-- ─── Seed indicators (27 indicators : 9 per pillar) ───────────────────────────
INSERT INTO indicators (code, wb_code, name, pillar, unit, source, higher_is_better) VALUES
  -- Environmental
  ('E1', 'EN.ATM.CO2E.PC',    'CO₂ emissions per capita',                'E', 't/person',        'World Bank / OWID', false),
  ('E2', 'EN.ATM.GHGT.KT.CE', 'GHG emissions per capita',                'E', 'tCO2e',           'World Bank',        false),
  ('E3', 'EG.FEC.RNEW.ZS',    'Renewable energy share',                  'E', '%',               'World Bank',        true),
  ('E4', 'AG.LND.FRST.ZS',    'Forest area (% of land)',                 'E', '%',               'World Bank',        true),
  ('E5', 'ER.LND.TOTL.HC',    'Tree cover loss',                         'E', 'Mha/yr',          'World Bank',        false),
  ('E6', 'EG.CFT.ACCS.ZS',    'Access to clean fuels for cooking',       'E', '%',               'World Bank',        true),
  ('E7', 'EN.ATM.PM25.MC.M3', 'PM2.5 air pollution (mean annual)',       'E', 'µg/m³',           'World Bank',        false),
  ('E8', 'ER.H2O.FWTL.ZS',    'Freshwater withdrawals',                  'E', '% of resources',  'World Bank',        false),
  ('E9', 'ER.CST.COASTAL',     'Coastal protection index',               'E', '0–100',           'World Bank',        true),
  -- Social
  ('S1', 'SG.LAW.INDX',       'Gender equality index (WBL)',             'S', '0–100',           'World Bank',        true),
  ('S2', 'SI.POV.GINI',       'Gini index (income inequality)',          'S', '0–100',           'World Bank',        false),
  ('S3', 'SE.PRM.CMPT.ZS',    'Primary education completion rate',       'S', '%',               'World Bank',        true),
  ('S4', 'SP.DYN.LE00.IN',    'Life expectancy at birth',                'S', 'years',           'World Bank',        true),
  ('S5', 'SI.POV.DDAY',       'Poverty headcount ($2.15/day PPP)',       'S', '%',               'World Bank',        false),
  ('S6', 'SI.POV.PROS.GAP',   'Prosperity gap ($25/day standard)',       'S', '$/day',           'World Bank',        false),
  ('S7', 'SH.STA.SMSS.ZS',    'Access to safely managed sanitation',    'S', '%',               'World Bank',        true),
  ('S8', 'SL.UEM.TOTL.ZS',    'Unemployment rate (ILO modeled)',         'S', '%',               'World Bank',        false),
  ('S9', 'SL.UEM.NEET.ZS',    'Youth NEET rate',                        'S', '%',               'World Bank',        false),
  -- Governance
  ('G1', 'RL.EST',             'Rule of law',                            'G', '−2.5–2.5',        'World Bank WGI',    true),
  ('G2', 'CC.EST',             'Control of corruption',                  'G', '−2.5–2.5',        'World Bank WGI',    true),
  ('G3', 'GE.EST',             'Government effectiveness',               'G', '−2.5–2.5',        'World Bank WGI',    true),
  ('G4', 'PV.EST',             'Political stability & absence of violence','G','−2.5–2.5',       'World Bank WGI',    true),
  ('G5', 'RQ.EST',             'Regulatory quality',                     'G', '−2.5–2.5',        'World Bank WGI',    true),
  ('G6', 'VA.EST',             'Voice and accountability',               'G', '−2.5–2.5',        'World Bank WGI',    true),
  ('G7', 'IQ.SPI.OVRL',       'Statistical performance index',          'G', '0–100',           'World Bank',        true),
  ('G8', 'SG.ESR.FULM',       'Economic & social rights fulfillment',   'G', '0–100',           'World Bank',        true),
  ('G9', 'IT.NET.USER.ZS',    'Internet access (digital governance proxy)','G','%',             'World Bank',        true)
ON CONFLICT (code) DO NOTHING;
