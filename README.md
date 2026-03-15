# 🦉 Hibou — Auditable ESG Scores for Countries

Hibou is an opinionated ESG explorer for sovereign countries. It favors traceable sources, percentile scoring, and visible data gaps over glossy narratives or black‑box ratings.

**Live demo:** https://hibou.thomaslfb.eu

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Data Sources                        │
│  World Bank ESG Bulk CSV  ·  OWID CO2 CSV               │
└────────────────────┬────────────────────────────────────┘
                     │ Python ingestion pipeline
┌────────────────────▼────────────────────────────────────┐
│               Supabase (PostgreSQL)                     │
│  countries · indicators · scores · esg_summary          │
│  country_context · country_info · country_stats         │
│  Scores + narratives + country stats pre-computed       │
└────────────────────┬────────────────────────────────────┘
                     │ @supabase/ssr  (RSC data fetching)
┌────────────────────▼────────────────────────────────────┐
│              Next.js 16 App Router                      │
│  /            World Map (choropleth)                    │
│  /country/[iso2]  Country Profile                       │
│  /compare     Side-by-side comparison                   │
│  /rankings    Sortable global table                     │
└─────────────────────────────────────────────────────────┘
```

**Stack:** Next.js 16 · TypeScript · Supabase · Python 3.11 · LLM (Anthropic or Ollama)

**Data:** World Bank ESG Portal (Jan 2026, CC BY 4.0) · World Development Indicators (WDI) · Our World in Data (CC BY)

---

## Methodology (Scoring)

We use percentiles because ESG indicators are on incompatible scales, and we carry data forward so a country doesn’t vanish when a year is missing. Coverage is treated as confidence, not punishment.

1. **Ingest raw indicator values**
   - World Bank ESG bulk CSV supplies most indicators.
   - OWID CO2 replaces the World Bank CO2 series for better coverage.
   - WDI adds macro context (GDP, population, land area) and optional Social add‑ons.

2. **Percentile normalisation per indicator/year**
   - For each indicator + year, compute the percentile rank across countries.
   - If `higher_is_better = false`, the percentile is inverted.
   - Percentiles are stored as `scores.normalized` (0.0–1.0).
   - Peer percentiles are computed within **income groups** for fairer comparisons.

3. **Carry-forward with recency weighting**
   - For a given country/year, each indicator uses the most recent value `<= year`.
   - Older values are down‑weighted using a half‑life curve (default: 5 years).

4. **Pillar scores (E/S/G)**
   - Weighted mean of indicator percentiles within a pillar.
   - Converted to a 0–100 score for display.

5. **Coverage‑aware adjustment**
   - Coverage is `(# indicators available / # active indicators)`.
   - Missing indicators are treated as **neutral** (50), not zero:
     `adjusted = raw * coverage + 50 * (1 - coverage)`.
   - This makes coverage a confidence factor rather than a penalty.

6. **Overall ESG score**
   - Average of E, S, and G (only if all three exist), then coverage‑adjusted.

7. **Data completeness flag**
   - `data_complete = true` if each pillar has at least 7/9 indicators.

8. **Ranks**
   - Global ranks and peer (income‑group) ranks are computed per year.

This methodology is implemented in `ESGCSV/compute_summary.py`.

---

## Quick Start

### Local (no Docker)

1. Copy env file and fill in keys:
   ```bash
   cp .env.local.example .env.local
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create the schema in Supabase:
   - Run `supabase/migrations/001_initial_schema.sql` in Supabase → SQL Editor
4. (Recommended) Ingest data (download CSVs into `ESGCSV/` first):
   ```bash
   cd ESGCSV
   pip install -r requirements.txt
   python seed_countries.py --csv ESG_data.csv
   python ingest_worldbank.py --csv ESG_data.csv   # defaults to 2018–2023
   python ingest_owid.py --download                # defaults to 2018–2023
   python ingest_wdi.py                            # GDP, population, land area (WDI)
   python compute_summary.py
   python generate_narratives.py
   python generate_context.py
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```

### Docker (app only)

1. Copy env file and fill in keys:
   ```bash
   cp .env.local.example .env.local
   ```
2. Start the app:
   ```bash
   docker compose up
   ```
3. Open `http://localhost:3000`

Notes:
- The Docker setup runs the Next.js app only. Supabase remains external.
- Run the ingestion scripts on your host (see Local Setup below).

---

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- A [Supabase](https://supabase.com) project (free tier)
- An LLM provider: Anthropic or Ollama (local)

### 1. Clone and install

```bash
git clone <your-repo>
cd hibou
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_KEY=your-secret-key              # server/ingestion only (service role)
# LLM provider: anthropic | ollama
LLM_PROVIDER=anthropic

# Anthropic (optional if using Ollama)
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# Ollama (optional if using Anthropic)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_TIMEOUT=180

# Optional admin secret for server-to-server AI requests
# Generate with: openssl rand -hex 32
HIBOU_API_SECRET=your-secret
```

Find Supabase keys at: **Project Settings → API**.
Use **Publishable** for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and **Secret** for `SUPABASE_KEY`.

**AI routes auth:** `/api/narrative` and `/api/context` are read-only and require a
Supabase auth session. If you have no auth flow, those endpoints will return 401.
For server-to-server use, send `X-Hibou-Admin` with `HIBOU_API_SECRET`.

**LLM selection:** If `LLM_PROVIDER` is unset, Hibou auto-selects when only one
provider is configured. If both are configured, set `LLM_PROVIDER`.

**Ingestion note:** `ESGCSV/generate_narratives.py` and `ESGCSV/generate_context.py`
use the same `LLM_PROVIDER` (Anthropic or Ollama).

### 3. Create the database schema

In your Supabase project → **SQL Editor**, paste and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates the 7 tables (`countries`, `indicators`, `scores`, `esg_summary`,
`country_context`, `country_info`, `country_stats`) and seeds all 27 ESG indicators.

### 4. Run the ingestion pipeline

Download the source data:
- **World Bank ESG CSV** → [datacatalog.worldbank.org](https://datacatalog.worldbank.org/search/dataset/0037651)
  - Extract `ESG_data.csv` and `ESGCountry.csv` into `ESGCSV/`
- **OWID CO2 CSV** → [github.com/owid/co2-data](https://github.com/owid/co2-data)
  - Save as `ESGCSV/owid-co2-data.csv` (or use `--download`)
- **WDI macro indicators** are fetched via API by `ingest_wdi.py` (no manual download).

Install Python dependencies and run the scripts in order:

```bash
cd ESGCSV
pip install -r requirements.txt

python seed_countries.py --csv ESG_data.csv   # 1. Populate countries table (uses ESGCountry.csv)
python ingest_worldbank.py --csv ESG_data.csv # 2. Ingest 27 indicators (defaults to 2018–2023)
python ingest_owid.py --download              # 3. Overwrite E1 with better OWID data (2018–2023)
python ingest_wdi.py                           # 4. GDP, population, land area (WDI)
python ingest_restcountries.py                 # 5. Optional: capital & languages (RestCountries)
python ingest_wdi_social.py                    # 6. Optional: add Social indicators (WDI)
python balance_indicators.py --apply           # 7. Optional: balance active indicators (6 per pillar)
python compute_summary.py                      # 8. Normalise scores, compute ranks
python generate_narratives.py                  # 9. Generate AI narratives
python generate_context.py                     # 10. Generate country context blocks
```

All scripts are idempotent — safe to re-run. Use `--min-year/--max-year` to change the year window.
To load capital/language fields, run `ingest_restcountries.py` (recommended) or
pass `--info-csv path/to/country_info.csv` to `ingest_wdi.py`.
If the WDI API times out, retry with smaller pages or a longer timeout:
`python ingest_wdi.py --per-page 1000 --timeout 120 --retries 5`

### Optional: audit indicator direction & coverage

```bash
python audit_indicators.py --pillar S --min-year 2018 --max-year 2024 --show-years
```

This prints Social indicator directions (`higher_is_better`), coverage by year, and
effective weight share (data availability). Use it to spot direction mismatches or
unbalanced indicators before adjusting weights.

To deactivate low-coverage indicators automatically:

```bash
python audit_indicators.py --pillar S --min-year 2018 --max-year 2024 --deactivate-below 0.15 --apply
```

To force a balanced 6/6/6 active indicator split across pillars:

```bash
python balance_indicators.py --apply
```

### 5. Start the dev server

```bash
npm run dev    # http://localhost:3000
```

### Optional: regenerate TypeScript DB types

```bash
# Add SUPABASE_PROJECT_ID to .env.local, then:
npm run db:types
```

---

## Project Structure

```
hibou/
├── app/
│   ├── layout.tsx                  # Root layout, nav header
│   ├── page.tsx                    # / → World Map
│   ├── country/[iso2]/page.tsx     # Country Profile
│   ├── compare/page.tsx            # Side-by-side comparison
│   ├── rankings/page.tsx           # Sortable global table
│   └── api/
│       ├── narrative/route.ts      # AI narrative endpoint
│       └── context/route.ts        # Country context endpoint
├── components/
│   ├── map/WorldMap.tsx            # Choropleth map
│   ├── charts/EsgCharts.tsx        # Radar + bar charts (Recharts)
│   ├── compare/                    # Compare page components
│   ├── profile/                    # Country profile components
│   ├── rankings/RankingsTable.tsx  # Sortable rankings table
│   └── ui/                         # Shared primitives
├── lib/
│   ├── supabase/                   # Server + client Supabase helpers
│   ├── data/repository.ts          # All DB queries
│   ├── utils/scores.ts             # Score → colour utilities
│   └── tokens.ts                   # Design tokens
├── ESGCSV/                         # Python data pipeline (10 scripts)
├── supabase/migrations/            # SQL schema
└── types/
    ├── hibou.ts                    # App interfaces
    └── supabase.ts                 # Generated DB types
```

---

## ESG Indicators

27 core indicators across 3 pillars. Scores are percentile‑normalised (0–100) per indicator/year,
then coverage‑adjusted per pillar. Peer scores use the same method but compute percentiles
within income groups. Optional WDI add‑ons expand the Social pillar with drinking water
and secondary enrollment indicators. Use `balance_indicators.py` to keep an even 6/6/6
indicator split across E/S/G.

| Pillar | Count | Examples |
|---|---|---|
| 🌿 Environmental | 9 | CO₂/capita, Renewable energy share, Forest area |
| 👥 Social | 9 (+ WDI add-ons) | Life expectancy, Gender equality, Poverty headcount |
| 🏛 Governance | 9 | Rule of law, Control of corruption, Internet access |

> ⚠️ **Income bias:** Scores reflect absolute performance vs all countries. Wealthier countries structurally score higher on most Social indicators. A low CO₂ score in a poor country reflects energy poverty, not environmental policy. Filter by income group for fair peer comparison.

---

## Deployment (Vercel)

```bash
npm run build   # verify build passes locally first
```

1. Push to GitHub
2. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql`
3. In Supabase → Project Settings → API, copy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable)
   - `SUPABASE_KEY` (secret, ingestion only)
4. Ingest data locally (see **Quick Start**).
5. Import the GitHub repo at [vercel.com](https://vercel.com)
6. Add env vars in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `HIBOU_API_SECRET` (optional but recommended for admin use)
7. Deploy — Vercel auto-detects Next.js

**Notes**
- The production app only needs the **publishable** key. Keep `SUPABASE_KEY`
  off Vercel and use it only on your ingestion machine.
- RLS is enabled in the migration; public read policies are included by default.

---

## Production Checklist

1. **Data sanity**
   - Verify `esg_summary` rows exist for your chosen year range.
2. **Smoke tests**
   - `/` map loads, `/rankings` sorts, `/compare` renders.
3. **Monitoring**
   - Add uptime checks and error monitoring (Sentry or similar).

## Data Sources

| Source | License | Used for |
|---|---|---|
| [World Bank ESG Data Portal](https://esgdata.worldbank.org) | CC BY 4.0 | 26 of 27 indicators |
| [Our World in Data — CO2](https://github.com/owid/co2-data) | CC BY | E1: CO₂ per capita (better coverage) |
| [World Bank WGI](https://info.worldbank.org/governance/wgi/) | CC BY 4.0 | G1–G6: Governance indicators (included in ESG bulk) |
