#!/usr/bin/env python3
# ingestion/ingest_wdi.py
# ──────────────────────────────────────────────────────────────────────────────
# Script 4 of 7 — ingest World Development Indicators (WDI) for country info + stats.
#
# Fetches GDP (current USD), total population, and land area (km²) via the
# World Bank API and stores them in:
#   - country_stats (yearly GDP/pop + GDP per capita)
#   - country_info  (latest land area per country)
#
# Optional: merge a CSV for capital/language fields.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python ingest_wdi.py
#   python ingest_wdi.py --min-year 2018 --max-year 2023
#   python ingest_wdi.py --info-csv country_info.csv
#   python ingest_wdi.py --timeout 120 --retries 5 --per-page 1000
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import csv
import sys
from datetime import datetime
from typing import Optional

from utils import get_supabase_client
from wdi_client import fetch_wdi_series, load_country_map, DEFAULT_PER_PAGE, DEFAULT_TIMEOUT, DEFAULT_RETRIES
DEFAULT_MIN_YEAR = 2018
DEFAULT_MAX_YEAR = 2023
WDI_INDICATORS = {
    "gdp_usd": "NY.GDP.MKTP.CD",
    "population": "SP.POP.TOTL",
    "area_km2": "AG.LND.TOTL.K2",
}


def parse_info_csv(path: str, country_map: dict[str, int]) -> list[dict]:
    rows: list[dict] = []
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            iso3 = (row.get("iso3") or row.get("ISO3") or "").strip().upper()
            if not iso3 or iso3 not in country_map:
                continue
            payload = {
                "country_id": country_map[iso3],
                "capital_city": row.get("capital_city") or row.get("capital") or None,
                "official_languages": row.get("official_languages") or row.get("languages") or None,
                "area_km2": _to_number(row.get("area_km2") or row.get("area")),
                "source": "CSV",
                "updated_at": datetime.utcnow().isoformat(),
            }
            rows.append(payload)
    return rows


def _to_number(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def batch_upsert(supabase, table: str, rows: list[dict], on_conflict: str, batch_size: int = 500) -> None:
    if not rows:
        return
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table(table).upsert(batch, on_conflict=on_conflict).execute()
        pct = min(100, round((i + len(batch)) / len(rows) * 100))
        print(f"  {table}: {i + len(batch)}/{len(rows)} ({pct}%)", end="\r")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest WDI country stats and info.")
    parser.add_argument("--min-year", type=int, default=DEFAULT_MIN_YEAR)
    parser.add_argument("--max-year", type=int, default=DEFAULT_MAX_YEAR)
    parser.add_argument("--info-csv", type=str, help="Optional CSV with capital/language fields")
    parser.add_argument("--per-page", type=int, default=DEFAULT_PER_PAGE, help="WDI API page size")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="WDI request timeout (seconds)")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="WDI retry attempts per page")
    args = parser.parse_args()

    if args.min_year > args.max_year:
        print("ERROR: --min-year must be <= --max-year")
        sys.exit(1)

    supabase = get_supabase_client()
    country_map = load_country_map(supabase)
    if not country_map:
        print("ERROR: No country mappings found. Run seed_countries.py first.")
        sys.exit(1)

    stats: dict[tuple[int, int], dict] = {}
    latest_area: dict[int, tuple[int, float]] = {}

    print("Fetching WDI indicators…")
    for field, code in WDI_INDICATORS.items():
        series = fetch_wdi_series(
            code,
            args.min_year,
            args.max_year,
            args.per_page,
            args.timeout,
            args.retries,
        )
        for row in series:
            iso3 = (row.get("countryiso3code") or "").strip().upper()
            if not iso3 or iso3 not in country_map:
                continue
            value = row.get("value")
            if value is None:
                continue
            try:
                year = int(row.get("date"))
            except (TypeError, ValueError):
                continue

            country_id = country_map[iso3]

            if field == "area_km2":
                prev = latest_area.get(country_id)
                if prev is None or year > prev[0]:
                    latest_area[country_id] = (year, float(value))
                continue

            key = (country_id, year)
            entry = stats.setdefault(key, {
                "country_id": country_id,
                "year": year,
                "source": "WDI",
            })
            if field == "population":
                try:
                    entry[field] = int(round(float(value)))
                except (TypeError, ValueError):
                    continue
            else:
                entry[field] = float(value)

    # Compute GDP per capita when possible
    for entry in stats.values():
        gdp = entry.get("gdp_usd")
        population = entry.get("population")
        if gdp is not None and population:
            entry["gdp_per_capita"] = gdp / population

    stats_rows = list(stats.values())
    print(f"\nUpserting {len(stats_rows)} country_stats rows…")
    batch_upsert(supabase, "country_stats", stats_rows, on_conflict="country_id,year")

    info_rows = [
        {
            "country_id": country_id,
            "area_km2": area,
            "source": "WDI",
            "updated_at": datetime.utcnow().isoformat(),
        }
        for country_id, (_year, area) in latest_area.items()
    ]
    print(f"\nUpserting {len(info_rows)} country_info rows (area)…")
    batch_upsert(supabase, "country_info", info_rows, on_conflict="country_id")

    if args.info_csv:
        csv_rows = parse_info_csv(args.info_csv, country_map)
        print(f"\nUpserting {len(csv_rows)} country_info rows (CSV)…")
        batch_upsert(supabase, "country_info", csv_rows, on_conflict="country_id")

    print("\n✓ WDI ingestion complete.")


if __name__ == "__main__":
    main()
