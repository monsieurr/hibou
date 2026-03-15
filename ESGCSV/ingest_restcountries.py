#!/usr/bin/env python3
# ESGCSV/ingest_restcountries.py
# ──────────────────────────────────────────────────────────────────────────────
# Fetch capital + language metadata from RestCountries and upsert into
# `country_info`. Uses ISO3 to match `countries`.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python ingest_restcountries.py
#   python ingest_restcountries.py --include-area
#   python ingest_restcountries.py --timeout 60 --retries 3
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
from datetime import datetime, timezone
import time

import requests

from utils import get_supabase_client
from wdi_client import load_country_map

RESTCOUNTRIES_URL = "https://restcountries.com/v3.1/all?fields=cca3,capital,languages,area,name"
DEFAULT_TIMEOUT = 60
DEFAULT_RETRIES = 3


def fetch_restcountries(timeout: int, retries: int) -> list[dict]:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(RESTCOUNTRIES_URL, timeout=timeout)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                raise RuntimeError("Unexpected RestCountries payload format.")
            return payload
        except Exception as exc:
            last_error = exc
            if attempt >= retries:
                break
            wait = 2 ** attempt
            print(f"  [retry] RestCountries attempt {attempt}/{retries} : waiting {wait}s…")
            time.sleep(wait)
    raise last_error or RuntimeError("RestCountries fetch failed.")


def normalize_capital(value: object) -> str | None:
    if isinstance(value, list) and value:
        return str(value[0]).strip() or None
    if isinstance(value, str):
        return value.strip() or None
    return None


def normalize_languages(value: object) -> str | None:
    if isinstance(value, dict):
        languages = [str(v).strip() for v in value.values() if str(v).strip()]
        return ", ".join(languages) if languages else None
    if isinstance(value, list):
        languages = [str(v).strip() for v in value if str(v).strip()]
        return ", ".join(languages) if languages else None
    if isinstance(value, str):
        return value.strip() or None
    return None


def truncate(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    return value.strip()[:limit]


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
    parser = argparse.ArgumentParser(description="Ingest capital/language metadata from RestCountries.")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="HTTP timeout (seconds)")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="Retry attempts")
    parser.add_argument("--include-area", action="store_true", help="Store area_km2 from RestCountries (overwrites)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and count rows without DB writes")
    args = parser.parse_args()

    supabase = get_supabase_client()
    country_map = load_country_map(supabase)
    if not country_map:
        print("ERROR: No country mappings found. Run seed_countries.py first.")
        return

    print("Downloading country metadata from RestCountries…")
    countries = fetch_restcountries(args.timeout, args.retries)

    rows: list[dict] = []
    for row in countries:
        iso3 = (row.get("cca3") or "").strip().upper()
        if not iso3 or iso3 not in country_map:
            continue

        payload = {
            "country_id": country_map[iso3],
            "capital_city": truncate(normalize_capital(row.get("capital")), 80),
            "official_languages": truncate(normalize_languages(row.get("languages")), 120),
            "source": "RestCountries",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if args.include_area:
            area = row.get("area")
            try:
                payload["area_km2"] = float(area) if area is not None else None
            except (TypeError, ValueError):
                payload["area_km2"] = None

        rows.append(payload)

    print(f"\nUpserting {len(rows)} country_info rows (capital/languages)…")
    if args.dry_run:
        print("(DRY RUN) No database writes.")
        return

    batch_upsert(supabase, "country_info", rows, on_conflict="country_id")
    print("\n✓ RestCountries metadata ingestion complete.")


if __name__ == "__main__":
    main()
