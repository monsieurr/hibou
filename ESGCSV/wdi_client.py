#!/usr/bin/env python3
# ESGCSV/wdi_client.py
# Shared helpers for fetching World Development Indicators (WDI) data.

from __future__ import annotations
import time
from typing import Optional

import requests

WDI_BASE = "https://api.worldbank.org/v2/country/all/indicator"
DEFAULT_PER_PAGE = 2000
DEFAULT_TIMEOUT = 90
DEFAULT_RETRIES = 3


def load_country_map(supabase) -> dict[str, int]:
    """Return iso3 → country_id mapping from DB (sovereign countries only)."""
    result = supabase.table("countries").select("id, iso3, iso2, region, income_group").execute()
    mapping: dict[str, int] = {}
    for row in (result.data or []):
        iso3 = (row.get("iso3") or "").strip().upper()
        iso2 = (row.get("iso2") or "").strip().upper()
        region = (row.get("region") or "").strip()
        income = (row.get("income_group") or "").strip()
        if not iso3 or len(iso3) != 3 or not iso3.isalpha():
            continue
        if not region or not income:
            continue
        if len(iso2) != 2 or not iso2.isalpha():
            continue
        mapping[iso3] = row["id"]
    return mapping


def fetch_wdi_series(
    code: str,
    min_year: int,
    max_year: int,
    per_page: int,
    timeout: int,
    retries: int,
) -> list[dict]:
    results: list[dict] = []
    page = 1

    while True:
        url = (
            f"{WDI_BASE}/{code}"
            f"?format=json&per_page={per_page}&page={page}&date={min_year}:{max_year}"
        )

        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                response = requests.get(url, timeout=timeout)
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, list) or len(payload) < 2:
                    raise RuntimeError(f"Unexpected WDI payload for {code} (page {page})")
                meta = payload[0] or {}
                data = payload[1] or []
                results.extend(data)
                pages = int(meta.get("pages") or 1)
                if page >= pages:
                    return results
                page += 1
                break
            except Exception as exc:
                last_error = exc
                if attempt >= retries:
                    raise
                wait = 2 ** attempt
                print(f"  [retry] {code} page {page} attempt {attempt}/{retries} — waiting {wait}s…")
                time.sleep(wait)

        if last_error:
            raise last_error

    return results
