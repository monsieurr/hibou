#!/usr/bin/env python3
# ingestion/ingest_owid.py
# ──────────────────────────────────────────────────────────────────────────────
# Script 3 of 5 — overwrite E1 (CO₂ per capita) with Our World in Data data.
#
# OWID has better coverage and recency than World Bank for CO₂ per capita.
# This script upserts E1 scores, overwriting any existing WB data for the same
# (country_id, indicator_id, year) combination.
#
# Input:  OWID CO2 CSV from https://github.com/owid/co2-data
#         Download: https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv
# Output: `scores` table — E1 rows updated with OWID values.
#
# Idempotent: upserts on (country_id, indicator_id, year). Safe to re-run.
# Prerequisites: seed_countries.py and ingest_worldbank.py must have run first.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python ingestion/ingest_owid.py --csv path/to/owid-co2-data.csv
#   python ingestion/ingest_owid.py --download  # auto-download from GitHub
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import csv
import sys
import urllib.request
from pathlib import Path

from utils import get_supabase_client

OWID_URL    = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv"
OWID_SOURCE = "Our World in Data CO2 dataset — https://github.com/owid/co2-data"

# We only import years with reasonably complete OWID coverage
DEFAULT_MIN_YEAR = 2018
DEFAULT_MAX_YEAR = 2023


def download_owid(dest: Path) -> Path:
    """Download OWID CO2 CSV to a local file."""
    print(f"Downloading OWID CO2 dataset from GitHub…")
    urllib.request.urlretrieve(OWID_URL, dest)
    print(f"  Saved to {dest}")
    return dest


def get_indicator_id(supabase) -> int:
    """Return the DB id for indicator code E1."""
    result = supabase.table("indicators").select("id").eq("code", "E1").single().execute()
    if not result.data:
        print("ERROR: E1 indicator not found. Run ingest_worldbank.py first.")
        sys.exit(1)
    return result.data["id"]


def load_country_map(supabase) -> dict[str, int]:
    """Return iso3 → country_id for sovereign countries only."""
    result = supabase.table("countries").select("id, iso3, iso2, region, income_group").execute()
    by_iso3 = {}
    for row in (result.data or []):
        iso2 = (row.get("iso2") or "").strip()
        region = (row.get("region") or "").strip()
        income = (row.get("income_group") or "").strip()
        if not region or not income:
            continue
        if len(iso2) != 2 or not iso2.isalpha():
            continue
        by_iso3[row["iso3"].upper()] = row["id"]
    return by_iso3


def ingest_owid(
    csv_path: Path,
    supabase,
    indicator_id: int,
    country_map: dict[str, int],
    min_year: int,
    max_year: int,
) -> None:
    print(f"\nParsing {csv_path}…")

    scores: list[dict] = []
    skipped_countries: set[str] = set()
    rows_seen = 0

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        # OWID CO2 CSV key columns
        iso3_col = next((h for h in headers if h.lower() in ("iso_code", "iso3", "country_code")), None)
        year_col = next((h for h in headers if h.lower() == "year"), None)
        co2_col  = next((h for h in headers if h.lower() == "co2_per_capita"), None)

        if not iso3_col or not year_col or not co2_col:
            print(f"ERROR: Could not find required OWID columns.")
            print(f"  Found headers: {headers[:15]}")
            print(f"  Expected: iso_code, year, co2_per_capita")
            sys.exit(1)

        for row in reader:
            rows_seen += 1
            iso3     = row.get(iso3_col, "").strip().upper()
            year_str = row.get(year_col, "").strip()
            co2_str  = row.get(co2_col,  "").strip()

            # Skip aggregates (OWID uses OWID_* codes for world regions)
            if not iso3 or iso3.startswith("OWID") or len(iso3) != 3:
                continue

            if not year_str or not co2_str or co2_str in ("", "nan", "NA"):
                continue

            try:
                year      = int(float(year_str))
                co2_value = float(co2_str)
            except ValueError:
                continue

            if year < min_year or year > max_year:
                continue

            country_id = country_map.get(iso3)
            if not country_id:
                skipped_countries.add(iso3)
                continue

            scores.append({
                "country_id":   country_id,
                "indicator_id": indicator_id,
                "year":         year,
                "raw_value":    co2_value,
                "normalized":   None,
                "data_source":  OWID_SOURCE,
            })

    print(f"  Parsed {rows_seen} OWID rows → {len(scores)} valid E1 entries.")
    if skipped_countries:
        print(f"  Skipped {len(skipped_countries)} OWID-only country/region codes.")

    if not scores:
        print("No scores to upsert. Check CSV format.")
        return

    # Upsert — overwrites any existing WB E1 data for the same (country, year)
    BATCH = 500
    for i in range(0, len(scores), BATCH):
        batch = scores[i : i + BATCH]
        supabase.table("scores").upsert(
            batch, on_conflict="country_id,indicator_id,year"
        ).execute()
        pct = min(100, round((i + len(batch)) / len(scores) * 100))
        print(f"  Progress: {i + len(batch)}/{len(scores)} ({pct}%)", end="\r")

    print(f"\n✓ OWID E1 (CO₂ per capita) ingested — {len(scores)} rows.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Overwrite E1 with OWID CO₂ data.")
    parser.add_argument("--min-year", type=int, default=DEFAULT_MIN_YEAR, help="Minimum year to ingest")
    parser.add_argument("--max-year", type=int, default=DEFAULT_MAX_YEAR, help="Maximum year to ingest")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--csv",      type=Path, help="Path to owid-co2-data.csv")
    group.add_argument("--download", action="store_true", help="Auto-download from GitHub")
    args = parser.parse_args()

    if args.download:
        dest = Path("/tmp/owid-co2-data.csv")
        csv_path = download_owid(dest)
    else:
        csv_path = args.csv

    supabase     = get_supabase_client()
    indicator_id = get_indicator_id(supabase)
    country_map  = load_country_map(supabase)
    ingest_owid(csv_path, supabase, indicator_id, country_map, args.min_year, args.max_year)


if __name__ == "__main__":
    main()
