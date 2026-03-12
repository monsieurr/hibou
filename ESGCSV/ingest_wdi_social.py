#!/usr/bin/env python3
# ESGCSV/ingest_wdi_social.py
# ──────────────────────────────────────────────────────────────────────────────
# Optional script — ingest additional Social indicators from WDI into `scores`.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python ingest_wdi_social.py
#   python ingest_wdi_social.py --min-year 2018 --max-year 2024
#   python ingest_wdi_social.py --per-page 1000 --timeout 120 --retries 5
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import sys
from typing import Optional

from utils import get_supabase_client
from wdi_client import fetch_wdi_series, load_country_map, DEFAULT_PER_PAGE, DEFAULT_TIMEOUT, DEFAULT_RETRIES

DEFAULT_MIN_YEAR = 2018
DEFAULT_MAX_YEAR = 2024
WDI_SOURCE = "World Bank WDI"

# Additional Social indicators with strong WDI coverage (non-mortality)
SOCIAL_WDI_INDICATORS = [
    {
        "code": "S13",
        "wb_code": "SH.H2O.BASW.ZS",
        "name": "Access to basic drinking water",
        "pillar": "S",
        "unit": "%",
        "higher_is_better": True,
    },
    {
        "code": "S15",
        "wb_code": "SE.SEC.ENRR",
        "name": "Secondary school enrollment (gross)",
        "pillar": "S",
        "unit": "%",
        "higher_is_better": True,
    },
]

DEPRECATED_CODES = ["S10", "S11", "S12"]


def deactivate_indicators(supabase, codes: list[str]) -> None:
    if not codes:
        return
    supabase.table("indicators").update({"is_active": False}).in_("code", codes).execute()
    print(f"  Deactivated indicators: {', '.join(codes)}")


def seed_indicators(supabase) -> dict[str, int]:
    deactivate_indicators(supabase, DEPRECATED_CODES)
    supabase.table("indicators").upsert(
        [
            {
                "code": ind["code"],
                "wb_code": ind["wb_code"],
                "name": ind["name"],
                "pillar": ind["pillar"],
                "unit": ind["unit"],
                "source": WDI_SOURCE,
                "higher_is_better": ind["higher_is_better"],
                "is_active": True,
            }
            for ind in SOCIAL_WDI_INDICATORS
        ],
        on_conflict="code",
    ).execute()

    result = supabase.table("indicators").select("id, code").execute()
    return {row["code"]: row["id"] for row in (result.data or [])}


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
    parser = argparse.ArgumentParser(description="Ingest additional Social indicators from WDI.")
    parser.add_argument("--min-year", type=int, default=DEFAULT_MIN_YEAR)
    parser.add_argument("--max-year", type=int, default=DEFAULT_MAX_YEAR)
    parser.add_argument("--per-page", type=int, default=DEFAULT_PER_PAGE, help="WDI API page size")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="WDI request timeout (seconds)")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="WDI retry attempts per page")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and count rows without DB upserts")
    args = parser.parse_args()

    if args.min_year > args.max_year:
        print("ERROR: --min-year must be <= --max-year")
        sys.exit(1)

    supabase = get_supabase_client()
    country_map = load_country_map(supabase)
    if not country_map:
        print("ERROR: No country mappings found. Run seed_countries.py first.")
        sys.exit(1)

    indicator_map = seed_indicators(supabase)
    if not indicator_map:
        print("ERROR: Could not seed indicators.")
        sys.exit(1)

    print("Fetching WDI social indicators…")
    total_rows = 0

    for ind in SOCIAL_WDI_INDICATORS:
        code = ind["wb_code"]
        label = f"{ind['code']} ({code})"
        try:
            series = fetch_wdi_series(
                code,
                args.min_year,
                args.max_year,
                args.per_page,
                args.timeout,
                args.retries,
            )
        except Exception as exc:
            print(f"  [warn] {label}: {exc}")
            continue

        rows: list[dict] = []
        indicator_id = indicator_map.get(ind["code"])
        if not indicator_id:
            print(f"  [warn] {label}: indicator id not found after seed.")
            continue

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

            rows.append({
                "country_id": country_map[iso3],
                "indicator_id": indicator_id,
                "year": year,
                "raw_value": float(value),
                "data_source": "WDI",
            })

        total_rows += len(rows)
        print(f"  {label}: {len(rows)} rows")

        if not args.dry_run:
            batch_upsert(supabase, "scores", rows, on_conflict="country_id,indicator_id,year")

    if args.dry_run:
        print(f"\n(DRY RUN) {total_rows} rows would be upserted.")
    else:
        print(f"\n✓ WDI social ingestion complete. {total_rows} rows upserted.")


if __name__ == "__main__":
    main()
