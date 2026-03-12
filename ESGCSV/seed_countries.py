#!/usr/bin/env python3
# ingestion/seed_countries.py
# ──────────────────────────────────────────────────────────────────────────────
# Script 1 of 5 — seed the `countries` table.
#
# Input:  World Bank country metadata CSV (downloaded from datacatalog.worldbank.org)
#         or the bundled country list derived from the ESG bulk CSV.
# Output: `countries` table — 214 rows with ISO codes, region, income group.
#
# Idempotent: uses upsert on iso2. Safe to re-run.
# Run first: all other scripts reference country_id foreign keys.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python ingestion/seed_countries.py --csv path/to/ESG_data.csv
#   python ingestion/seed_countries.py --api   # fetch metadata from WB API
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import csv
import json
import sys
import time
from pathlib import Path

import requests

from utils import get_supabase_client


# ── World Bank API metadata endpoint ──────────────────────────────────────────

WB_COUNTRIES_URL = (
    "https://api.worldbank.org/v2/country"
    "?format=json&per_page=300&incomeLevel=all"
)


def fetch_wb_metadata() -> list[dict]:
    """Fetch all country metadata from the World Bank API."""
    print("Fetching country metadata from World Bank API…")
    resp = requests.get(WB_COUNTRIES_URL, timeout=30)
    resp.raise_for_status()
    try:
        data = resp.json()
    except ValueError:
        print("ERROR: World Bank API returned non-JSON response.")
        print(f"HTTP {resp.status_code} — {resp.text[:500]}")
        sys.exit(1)

    # WB API returns [pagination_info, [countries]]
    if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
        print("ERROR: Unexpected World Bank API response format.")
        print(f"HTTP {resp.status_code} — {json.dumps(data)[:500]}")
        print("Tip: try `python seed_countries.py --csv path/to/ESG_data.csv` instead.")
        sys.exit(1)

    countries_raw = data[1]

    rows = []
    for c in countries_raw:
        # Skip aggregates (regions, income groups) — only keep sovereign countries
        if c.get("region", {}).get("id") == "NA":
            continue
        if not c.get("iso2Code", "").strip():
            continue

        rows.append({
            "iso2":         c["iso2Code"].strip().upper(),
            "iso3":         c["id"].strip().upper(),
            "name":         c["name"].strip(),
            "region":       c.get("region", {}).get("value", ""),
            "income_group": c.get("incomeLevel", {}).get("value", ""),
            "lat":          float(c["latitude"])  if c.get("latitude")  else None,
            "lng":          float(c["longitude"]) if c.get("longitude") else None,
        })

    print(f"  Fetched {len(rows)} sovereign countries from WB API.")
    return rows


def load_from_csv(csv_path: Path) -> list[dict]:
    """Extract unique country rows from the World Bank ESG bulk CSV.

    The bulk CSV has columns including: Country ISO3, Country Name, etc.
    This extracts unique countries and derives what it can from the CSV.
    For a full seed with lat/lng and income group, prefer --api.
    """
    print(f"Loading country list from {csv_path}…")

    rows_by_iso3: dict[str, dict] = {}

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        # Detect column names (WB CSV headers vary slightly between releases)
        iso3_col  = next((h for h in headers if "iso3" in h.lower() or "country code" in h.lower()), None)
        name_col  = next((h for h in headers if "country name" in h.lower()), None)
        region_col = next((h for h in headers if "region" in h.lower()), None)
        income_col = next((h for h in headers if "income" in h.lower()), None)

        if not iso3_col or not name_col:
            print(f"ERROR: Could not detect required columns in CSV.")
            print(f"  Available headers: {headers}")
            print("  Expected columns containing 'iso3' or 'country code', and 'country name'.")
            sys.exit(1)

        print(f"  Using columns: iso3={iso3_col!r}, name={name_col!r}")

        for row in reader:
            iso3 = row.get(iso3_col, "").strip().upper()
            name = row.get(name_col, "").strip()
            if not iso3 or not name or len(iso3) != 3:
                continue
            if iso3 in rows_by_iso3:
                continue

            rows_by_iso3[iso3] = {
                "iso3":         iso3,
                "iso2":         "",   # filled from WB API lookup below
                "name":         name,
                "region":       row.get(region_col or "", "").strip() if region_col else "",
                "income_group": row.get(income_col or "", "").strip() if income_col else "",
                "lat":          None,
                "lng":          None,
            }

    print(f"  Found {len(rows_by_iso3)} unique countries in CSV.")

    # Prefer local World Bank metadata CSV if available (ESGCountry.csv)
    country_csv = csv_path.parent / "ESGCountry.csv"
    if country_csv.exists():
        print(f"  Loading ISO2/region/income from {country_csv.name}…")
        try:
            with open(country_csv, newline="", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames or []
                iso3_col = next((h for h in headers if "country code" in h.lower()), None)
                iso2_col = next((h for h in headers if "2-alpha" in h.lower()), None)
                region_col = next((h for h in headers if "region" in h.lower()), None)
                income_col = next((h for h in headers if "income" in h.lower()), None)

                if iso3_col and iso2_col:
                    for row in reader:
                        iso3 = row.get(iso3_col, "").strip().upper()
                        iso2 = row.get(iso2_col, "").strip().upper()
                        if not iso3 or not iso2:
                            continue
                        if iso3 in rows_by_iso3:
                            target = rows_by_iso3[iso3]
                            target["iso2"] = target["iso2"] or iso2
                            if region_col:
                                target["region"] = target["region"] or row.get(region_col, "").strip()
                            if income_col:
                                target["income_group"] = target["income_group"] or row.get(income_col, "").strip()
                else:
                    print("  Warning: ESGCountry.csv missing expected columns; skipping local enrichment.")
        except Exception as e:
            print(f"  Warning: Could not read ESGCountry.csv: {e}")

    # Attempt to fill remaining iso2 from WB API
    missing_iso2 = [r for r in rows_by_iso3.values() if not r["iso2"]]
    if missing_iso2:
        print("  Fetching ISO2 codes and coordinates from WB API…")
        try:
            resp = requests.get(WB_COUNTRIES_URL, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
                raise ValueError("Unexpected World Bank API response format")
            wb_data = data[1]
            iso3_to_meta = {
                c["id"].upper(): c for c in wb_data
                if c.get("id") and len(c["id"]) == 3
            }
            for iso3, row in rows_by_iso3.items():
                if row["iso2"]:
                    continue
                meta = iso3_to_meta.get(iso3)
                if meta:
                    row["iso2"]         = meta.get("iso2Code", "").strip().upper()
                    row["lat"]          = float(meta["latitude"])  if meta.get("latitude")  else None
                    row["lng"]          = float(meta["longitude"]) if meta.get("longitude") else None
                    row["region"]       = row["region"] or meta.get("region", {}).get("value", "")
                    row["income_group"] = row["income_group"] or meta.get("incomeLevel", {}).get("value", "")
        except Exception as e:
            print(f"  Warning: Could not enrich with WB API: {e}")

    def is_sovereign(row: dict) -> bool:
        iso2 = (row.get("iso2") or "").strip().upper()
        region = (row.get("region") or "").strip()
        income = (row.get("income_group") or "").strip()
        if not iso2 or len(iso2) != 2 or not iso2.isalpha():
            return False
        if not region or not income:
            return False
        return True

    # Filter out aggregates and rows without resolvable ISO2/metadata
    valid = [r for r in rows_by_iso3.values() if is_sovereign(r)]
    skipped = len(rows_by_iso3) - len(valid)
    if skipped:
        print(f"  Skipped {skipped} rows without a resolvable ISO2 code.")

    return valid


def upsert_countries(rows: list[dict]) -> None:
    """Upsert all country rows into Supabase."""
    supabase = get_supabase_client()
    print(f"\nUpserting {len(rows)} countries to Supabase…")

    # Batch in chunks of 100 to stay within Supabase limits
    BATCH = 100
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        result = (
            supabase.table("countries")
            .upsert(batch, on_conflict="iso2")
            .execute()
        )
        print(f"  Batch {i // BATCH + 1}: upserted {len(batch)} rows")

    print("✓ Countries seeded.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Hibou countries table.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--csv",  type=Path, help="Path to World Bank ESG bulk CSV")
    group.add_argument("--api",  action="store_true", help="Fetch directly from WB API")
    args = parser.parse_args()

    if args.api:
        rows = fetch_wb_metadata()
    else:
        rows = load_from_csv(args.csv)

    if not rows:
        print("No country rows to insert. Exiting.")
        sys.exit(1)

    upsert_countries(rows)


if __name__ == "__main__":
    main()
