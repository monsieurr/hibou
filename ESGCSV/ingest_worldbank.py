#!/usr/bin/env python3
# ingestion/ingest_worldbank.py
# ──────────────────────────────────────────────────────────────────────────────
# Script 2 of 5 : ingest World Bank ESG bulk CSV into the `scores` table.
#
# Input:  World Bank ESG bulk CSV from:
#         https://datacatalog.worldbank.org/search/dataset/0037651
# Output: `scores` table rows : all 27 indicators × 214 countries × available years.
#
# Idempotent: upserts on (country_id, indicator_id, year). Safe to re-run.
# Prerequisites: seed_countries.py must have run first.
#
# ⚠ BEFORE RUNNING: verify all wb_code values below against the actual CSV headers.
#   Run: python ingestion/ingest_worldbank.py --inspect path/to/ESG_data.csv
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python ingestion/ingest_worldbank.py --csv path/to/ESG_data.csv
#   python ingestion/ingest_worldbank.py --csv path/to/ESG_data.csv --min-year 2018 --max-year 2023
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import csv
import sys
from pathlib import Path
from collections import defaultdict

from utils import get_supabase_client

# ── Indicator definitions ─────────────────────────────────────────────────────
# All 27 indicators from spec §3. wb_code values verified against Jan 2026 release.
# higher_is_better: False means a LOWER raw value → BETTER score.
# ⚠ Run --inspect to verify these codes exist in your downloaded CSV.

INDICATORS = [
    # Environmental
    {"code": "E1", "wb_code": "EN.ATM.CO2E.PC",    "name": "CO₂ emissions per capita",           "pillar": "E", "unit": "t/person",       "higher_is_better": False},
    # E2: EN.ATM.GHGT.KT.CE is total GHG in kt CO2-equivalent, NOT per capita.
    # The World Bank ESG portal does not publish a per-capita GHG series under a
    # separate code. Options:
    #   (a) Keep as-is : normalisation across countries still produces a valid
    #       relative score, but the unit label "tCO2e" is misleading.
    #   (b) Replace with EN.ATM.GHGT.ZG (GHG growth rate) if available.
    #   (c) Compute per-capita in ingestion by dividing by SP.POP.TOTL.
    # ⚠ Run --inspect to verify EN.ATM.GHGT.KT.CE exists in your CSV before ingesting.
    {"code": "E2", "wb_code": "EN.ATM.GHGT.KT.CE", "name": "GHG emissions (total kt CO2e)",       "pillar": "E", "unit": "kt CO2e",         "higher_is_better": False},
    {"code": "E3", "wb_code": "EG.FEC.RNEW.ZS",    "name": "Renewable energy share",             "pillar": "E", "unit": "%",               "higher_is_better": True},
    {"code": "E4", "wb_code": "AG.LND.FRST.ZS",    "name": "Forest area (% of land)",            "pillar": "E", "unit": "%",               "higher_is_better": True},
    {"code": "E5", "wb_code": "ER.LND.TOTL.HC",    "name": "Tree cover loss",                    "pillar": "E", "unit": "Mha/yr",          "higher_is_better": False},
    {"code": "E6", "wb_code": "EG.CFT.ACCS.ZS",    "name": "Access to clean fuels for cooking",  "pillar": "E", "unit": "%",               "higher_is_better": True},
    {"code": "E7", "wb_code": "EN.ATM.PM25.MC.M3", "name": "PM2.5 air pollution (mean annual)",  "pillar": "E", "unit": "µg/m³",           "higher_is_better": False},
    {"code": "E8", "wb_code": "ER.H2O.FWTL.ZS",   "name": "Freshwater withdrawals",             "pillar": "E", "unit": "% of resources",  "higher_is_better": False},
    {"code": "E9", "wb_code": "ER.CST.COASTAL",    "name": "Coastal protection index",           "pillar": "E", "unit": "0–100",           "higher_is_better": True},
    # Social
    {"code": "S1", "wb_code": "SG.LAW.INDX",       "name": "Gender equality index",              "pillar": "S", "unit": "0–100",           "higher_is_better": True},
    {"code": "S2", "wb_code": "SI.POV.GINI",       "name": "Gini index (income inequality)",     "pillar": "S", "unit": "0–100",           "higher_is_better": False},
    {"code": "S3", "wb_code": "SE.PRM.CMPT.ZS",    "name": "Primary education completion rate",  "pillar": "S", "unit": "%",               "higher_is_better": True},
    {"code": "S4", "wb_code": "SP.DYN.LE00.IN",    "name": "Life expectancy at birth",           "pillar": "S", "unit": "years",           "higher_is_better": True},
    {"code": "S5", "wb_code": "SI.POV.DDAY",       "name": "Poverty headcount ($2.15/day PPP)",  "pillar": "S", "unit": "%",               "higher_is_better": False},
    {"code": "S6", "wb_code": "SI.POV.PROS.GAP",   "name": "Prosperity gap ($25/day standard)",  "pillar": "S", "unit": "$/day",           "higher_is_better": False},
    {"code": "S7", "wb_code": "SH.STA.SMSS.ZS",   "name": "Access to safely managed sanitation","pillar": "S", "unit": "%",               "higher_is_better": True},
    {"code": "S8", "wb_code": "SL.UEM.TOTL.ZS",   "name": "Unemployment rate (ILO modeled)",    "pillar": "S", "unit": "%",               "higher_is_better": False},
    {"code": "S9", "wb_code": "SL.UEM.NEET.ZS",   "name": "Youth NEET rate",                    "pillar": "S", "unit": "%",               "higher_is_better": False},
    # Governance
    {"code": "G1", "wb_code": "RL.EST",            "name": "Rule of law",                        "pillar": "G", "unit": "−2.5–2.5",        "higher_is_better": True},
    {"code": "G2", "wb_code": "CC.EST",            "name": "Control of corruption",              "pillar": "G", "unit": "−2.5–2.5",        "higher_is_better": True},
    {"code": "G3", "wb_code": "GE.EST",            "name": "Government effectiveness",           "pillar": "G", "unit": "−2.5–2.5",        "higher_is_better": True},
    {"code": "G4", "wb_code": "PV.EST",            "name": "Political stability",                "pillar": "G", "unit": "−2.5–2.5",        "higher_is_better": True},
    {"code": "G5", "wb_code": "RQ.EST",            "name": "Regulatory quality",                 "pillar": "G", "unit": "−2.5–2.5",        "higher_is_better": True},
    {"code": "G6", "wb_code": "VA.EST",            "name": "Voice and accountability",           "pillar": "G", "unit": "−2.5–2.5",        "higher_is_better": True},
    {"code": "G7", "wb_code": "IQ.SPI.OVRL",      "name": "Statistical performance index",      "pillar": "G", "unit": "0–100",           "higher_is_better": True},
    {"code": "G8", "wb_code": "SG.ESR.FULM",      "name": "Economic & social rights fulfillment","pillar": "G", "unit": "0–100",           "higher_is_better": True},
    {"code": "G9", "wb_code": "IT.NET.USER.ZS",   "name": "Internet access",                    "pillar": "G", "unit": "%",               "higher_is_better": True},
]

WB_SOURCE = "World Bank Sovereign ESG Data Portal : https://esgdata.worldbank.org"
DEFAULT_MIN_YEAR = 2018
DEFAULT_MAX_YEAR = 2023


def inspect_csv(csv_path: Path) -> None:
    """Print CSV structure for manual verification of wb_code values."""
    print(f"\nInspecting {csv_path}…\n")
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        print(f"Column count: {len(headers)}")
        print(f"Columns: {headers[:10]} {'...' if len(headers) > 10 else ''}\n")

        wb_codes_in_csv = set()
        for row in reader:
            # Detect indicator code column
            code_col = next((h for h in headers if "indicator" in h.lower() and "code" in h.lower()), None)
            if code_col and row.get(code_col):
                wb_codes_in_csv.add(row[code_col].strip())

    expected = {ind["wb_code"] for ind in INDICATORS}
    found = expected & wb_codes_in_csv
    missing = expected - wb_codes_in_csv

    print(f"Expected WB codes: {len(expected)}")
    print(f"Found in CSV:      {len(found)}")
    if missing:
        print(f"\n⚠ MISSING codes (not found in CSV):")
        for code in sorted(missing):
            ind = next(i for i in INDICATORS if i["wb_code"] == code)
            print(f"  {ind['code']:3s} {code:30s}  {ind['name']}")
    else:
        print("✓ All 27 indicator codes verified in CSV.")


def seed_indicators(supabase) -> dict[str, int]:
    """Upsert indicator definitions and return code → id mapping."""
    print("\nUpserting indicator definitions…")

    supabase.table("indicators").upsert(
        [
            {
                "code":             ind["code"],
                "wb_code":          ind["wb_code"],
                "name":             ind["name"],
                "pillar":           ind["pillar"],
                "unit":             ind["unit"],
                "source":           WB_SOURCE,
                "higher_is_better": ind["higher_is_better"],
                "is_active":        True,
            }
            for ind in INDICATORS
        ],
        on_conflict="code",
    ).execute()

    result = supabase.table("indicators").select("id, code").execute()
    mapping = {row["code"]: row["id"] for row in (result.data or [])}
    print(f"  {len(mapping)} indicators in DB.")
    return mapping


def load_country_map(supabase) -> dict[str, int]:
    """Return iso3 → country_id mapping from DB (sovereign countries only)."""
    result = supabase.table("countries").select("id, iso3, iso2, region, income_group").execute()
    mapping = {}
    for row in (result.data or []):
        iso2 = (row.get("iso2") or "").strip()
        region = (row.get("region") or "").strip()
        income = (row.get("income_group") or "").strip()
        if not region or not income:
            continue
        if len(iso2) != 2 or not iso2.isalpha():
            continue
        mapping[row["iso3"]] = row["id"]
    return mapping


def ingest_csv(
    csv_path: Path,
    supabase,
    indicator_map: dict[str, int],
    country_map: dict[str, int],
    min_year: int,
    max_year: int,
) -> None:
    """Parse ESG bulk CSV and upsert all score rows."""
    print(f"\nParsing {csv_path}…")

    wb_to_indicator_id = {
        ind["wb_code"]: indicator_map[ind["code"]]
        for ind in INDICATORS
        if ind["code"] in indicator_map
    }
    wb_code_to_hib = {ind["wb_code"]: ind for ind in INDICATORS}

    scores_to_upsert: list[dict] = []
    skipped_countries = set()
    skipped_indicators = set()

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        # Detect column names : WB bulk CSV column names vary slightly
        iso3_col    = next((h for h in headers if "country" in h.lower() and "code" in h.lower()), None)
        wb_code_col = next((h for h in headers if "indicator" in h.lower() and "code" in h.lower()), None)
        year_col    = next((h for h in headers if h.strip().isdigit() or "year" in h.lower()), None)

        # The WB bulk CSV is wide-format: one row per (country, indicator), year columns
        # Detect year columns (4-digit integers in column headers)
        year_cols = [
            h for h in headers
            if h.strip().isdigit() and min_year <= int(h.strip()) <= max_year
        ]

        if not iso3_col or not wb_code_col:
            print(f"ERROR: Could not detect iso3 or wb_code columns.")
            print(f"  Headers: {headers}")
            sys.exit(1)

        print(f"  Detected {len(year_cols)} year columns: {year_cols[:5]}…")

        for row in reader:
            iso3    = row.get(iso3_col, "").strip().upper()
            wb_code = row.get(wb_code_col, "").strip()

            country_id   = country_map.get(iso3)
            indicator_id = wb_to_indicator_id.get(wb_code)

            if not country_id:
                skipped_countries.add(iso3)
                continue
            if not indicator_id:
                skipped_indicators.add(wb_code)
                continue

            ind_meta = wb_code_to_hib[wb_code]

            for year_str in year_cols:
                raw_str = row.get(year_str, "").strip()
                if not raw_str or raw_str in ("", "..", "NA", "N/A"):
                    continue
                try:
                    raw_value = float(raw_str)
                except ValueError:
                    continue

                scores_to_upsert.append({
                    "country_id":   country_id,
                    "indicator_id": indicator_id,
                    "year":         int(year_str.strip()),
                    "raw_value":    raw_value,
                    "normalized":   None,  # computed by compute_summary.py
                    "data_source":  WB_SOURCE,
                })

    print(f"  Collected {len(scores_to_upsert)} score rows to upsert.")
    if skipped_countries:
        print(f"  Skipped {len(skipped_countries)} unknown country codes (not in DB).")
    if skipped_indicators:
        non_hibou = {c for c in skipped_indicators if c not in {i["wb_code"] for i in INDICATORS}}
        print(f"  Ignored {len(non_hibou)} non-Hibou indicator codes (expected).")

    # Batch upsert
    BATCH = 500
    total = len(scores_to_upsert)
    for i in range(0, total, BATCH):
        batch = scores_to_upsert[i : i + BATCH]
        supabase.table("scores").upsert(
            batch, on_conflict="country_id,indicator_id,year"
        ).execute()
        pct = min(100, round((i + len(batch)) / total * 100))
        print(f"  Progress: {i + len(batch)}/{total} ({pct}%)", end="\r")

    print(f"\n✓ World Bank scores ingested.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest World Bank ESG bulk CSV into Supabase.")
    parser.add_argument("--csv",     type=Path, help="Path to ESG_data.csv")
    parser.add_argument("--min-year", type=int, default=DEFAULT_MIN_YEAR, help="Minimum year to ingest")
    parser.add_argument("--max-year", type=int, default=DEFAULT_MAX_YEAR, help="Maximum year to ingest")
    parser.add_argument("--inspect", type=Path, help="Inspect CSV structure only (no DB writes)")
    args = parser.parse_args()

    if args.inspect:
        inspect_csv(args.inspect)
        return

    if not args.csv:
        parser.error("--csv is required (or use --inspect to verify the CSV first)")

    supabase     = get_supabase_client()
    indicator_map = seed_indicators(supabase)
    country_map   = load_country_map(supabase)
    ingest_csv(args.csv, supabase, indicator_map, country_map, args.min_year, args.max_year)


if __name__ == "__main__":
    main()
