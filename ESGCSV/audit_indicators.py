#!/usr/bin/env python3
# ESGCSV/audit_indicators.py
# ──────────────────────────────────────────────────────────────────────────────
# Quick audit tool for indicator direction (higher_is_better) and data coverage.
# Focuses on Social indicators by default.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python audit_indicators.py                      # Social, all years
#   python audit_indicators.py --pillar S           # Explicit pillar
#   python audit_indicators.py --min-year 2018 --max-year 2024 --show-years
#   python audit_indicators.py --year 2023
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import math
from collections import defaultdict
from typing import Optional

from utils import get_supabase_client


def load_sovereign_ids(supabase) -> set[int]:
    result = supabase.table("countries").select("id, region, income_group, iso2").execute()
    ids: set[int] = set()
    for row in (result.data or []):
        region = (row.get("region") or "").strip()
        income = (row.get("income_group") or "").strip()
        iso2 = (row.get("iso2") or "").strip()
        if not region or not income:
            continue
        if len(iso2) != 2 or not iso2.isalpha():
            continue
        ids.add(row["id"])
    return ids


def load_indicators(supabase, pillar: str) -> list[dict]:
    result = supabase.table("indicators").select(
        "id, code, name, pillar, unit, higher_is_better, is_active"
    ).execute()
    rows = []
    for row in (result.data or []):
        if row.get("pillar") != pillar:
            continue
        if row.get("is_active", True) is False:
            continue
        rows.append(row)
    return sorted(rows, key=lambda r: r["code"])


def load_scores(
    supabase,
    indicator_ids: list[int],
    min_year: Optional[int],
    max_year: Optional[int],
) -> list[dict]:
    PAGE = 1000
    offset = 0
    rows: list[dict] = []
    while True:
        query = (
            supabase.table("scores")
            .select("indicator_id, country_id, year, raw_value, normalized")
            .in_("indicator_id", indicator_ids)
        )
        if min_year is not None:
            query = query.gte("year", min_year)
        if max_year is not None:
            query = query.lte("year", max_year)
        result = query.range(offset, offset + PAGE - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    return rows


def pearson_from_sums(n: int, sum_x: float, sum_y: float, sum_x2: float, sum_y2: float, sum_xy: float) -> Optional[float]:
    if n < 2:
        return None
    denom = math.sqrt((n * sum_x2 - sum_x ** 2) * (n * sum_y2 - sum_y ** 2))
    if denom == 0:
        return None
    return (n * sum_xy - sum_x * sum_y) / denom


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit indicator direction and coverage.")
    parser.add_argument("--pillar", type=str, default="S", help="Pillar to audit (E/S/G)")
    parser.add_argument("--min-year", type=int, help="Minimum year to include")
    parser.add_argument("--max-year", type=int, help="Maximum year to include")
    parser.add_argument("--year", type=int, help="Single year (overrides min/max)")
    parser.add_argument("--show-years", action="store_true", help="Print per-year coverage and correlation")
    parser.add_argument("--deactivate-below", type=float, help="Deactivate indicators with avg coverage below this ratio (0-1)")
    parser.add_argument("--flip-mismatched", action="store_true", help="Flip higher_is_better when correlation sign disagrees")
    parser.add_argument("--apply", action="store_true", help="Apply DB updates for --deactivate-below / --flip-mismatched")
    args = parser.parse_args()

    pillar = args.pillar.upper()
    if pillar not in {"E", "S", "G"}:
        raise SystemExit("ERROR: --pillar must be E, S, or G")

    min_year = args.year if args.year is not None else args.min_year
    max_year = args.year if args.year is not None else args.max_year

    supabase = get_supabase_client()
    sovereign_ids = load_sovereign_ids(supabase)
    total_countries = len(sovereign_ids)

    indicators = load_indicators(supabase, pillar)
    if not indicators:
        print(f"No indicators found for pillar {pillar}.")
        return

    indicator_ids = [row["id"] for row in indicators]
    scores = load_scores(supabase, indicator_ids, min_year, max_year)

    per_ind_year: dict[tuple[int, int], dict[str, float]] = defaultdict(lambda: {
        "n_raw": 0,
        "n_corr": 0,
        "sum_x": 0.0,
        "sum_y": 0.0,
        "sum_x2": 0.0,
        "sum_y2": 0.0,
        "sum_xy": 0.0,
    })
    per_ind_agg: dict[int, dict[str, float]] = defaultdict(lambda: {
        "n_raw": 0,
        "n_corr": 0,
        "sum_x": 0.0,
        "sum_y": 0.0,
        "sum_x2": 0.0,
        "sum_y2": 0.0,
        "sum_xy": 0.0,
    })

    seen: set[tuple[int, int, int]] = set()
    for row in scores:
        if row.get("country_id") not in sovereign_ids:
            continue
        triplet = (row["indicator_id"], row["year"], row["country_id"])
        if triplet in seen:
            continue
        seen.add(triplet)
        raw = row.get("raw_value")
        norm = row.get("normalized")
        key = (row["indicator_id"], row["year"])

        if raw is not None:
            per_ind_year[key]["n_raw"] += 1
            per_ind_agg[row["indicator_id"]]["n_raw"] += 1

        if raw is not None and norm is not None:
            per_ind_year[key]["n_corr"] += 1
            per_ind_year[key]["sum_x"] += raw
            per_ind_year[key]["sum_y"] += norm
            per_ind_year[key]["sum_x2"] += raw * raw
            per_ind_year[key]["sum_y2"] += norm * norm
            per_ind_year[key]["sum_xy"] += raw * norm

            per_ind_agg[row["indicator_id"]]["n_corr"] += 1
            per_ind_agg[row["indicator_id"]]["sum_x"] += raw
            per_ind_agg[row["indicator_id"]]["sum_y"] += norm
            per_ind_agg[row["indicator_id"]]["sum_x2"] += raw * raw
            per_ind_agg[row["indicator_id"]]["sum_y2"] += norm * norm
            per_ind_agg[row["indicator_id"]]["sum_xy"] += raw * norm

    total_rows_all = sum(per_ind_agg[ind["id"]]["n_raw"] for ind in indicators) or 0

    print(f"\nPillar: {pillar} · Sovereign countries: {total_countries}")
    if min_year or max_year:
        label = f"{min_year or '…'}–{max_year or '…'}"
        print(f"Year range: {label}")
    print(f"Indicators audited: {len(indicators)}\n")

    to_deactivate: list[int] = []
    to_flip: dict[int, bool] = {}

    for ind in indicators:
        ind_id = ind["id"]
        code = ind["code"]
        name = ind["name"]
        unit = ind.get("unit") or ""
        higher = bool(ind.get("higher_is_better", True))
        agg = per_ind_agg[ind_id]
        corr = pearson_from_sums(
            int(agg["n_corr"]), agg["sum_x"], agg["sum_y"],
            agg["sum_x2"], agg["sum_y2"], agg["sum_xy"]
        )
        corr_label = f"{corr:+.2f}" if corr is not None else "n/a"
        expected_sign = 1 if higher else -1
        mismatch = corr is not None and corr * expected_sign < -0.1

        year_keys = sorted([k for k in per_ind_year.keys() if k[0] == ind_id], key=lambda x: x[1], reverse=True)
        coverage_ratios = [
            per_ind_year[(ind_id, y)]["n_raw"] / total_countries
            for _ind, y in year_keys
            if total_countries > 0
        ]
        avg_coverage = sum(coverage_ratios) / len(coverage_ratios) if coverage_ratios else 0.0
        weight_share = (agg["n_raw"] / total_rows_all) if total_rows_all > 0 else 0.0

        direction_label = "higher is better" if higher else "lower is better"
        flag = " ⚠ direction mismatch" if mismatch else ""

        print(f"{code} · {name} ({unit})")
        print(f"  Direction: {direction_label} · Avg coverage: {avg_coverage:.0%} · Weight share: {weight_share:.1%} · Corr(raw, norm): {corr_label}{flag}")

        if args.show_years and year_keys:
            for _ind, year in year_keys:
                stat = per_ind_year[(ind_id, year)]
                coverage = stat["n_raw"] / total_countries if total_countries else 0.0
                year_corr = pearson_from_sums(
                    int(stat["n_corr"]), stat["sum_x"], stat["sum_y"],
                    stat["sum_x2"], stat["sum_y2"], stat["sum_xy"]
                )
                year_corr_label = f"{year_corr:+.2f}" if year_corr is not None else "n/a"
                print(f"    {year}: coverage {coverage:.0%} · corr {year_corr_label}")
        print()

        if args.deactivate_below is not None and avg_coverage < args.deactivate_below:
            to_deactivate.append(ind_id)
        if args.flip_mismatched and mismatch:
            to_flip[ind_id] = not higher

    if (to_deactivate or to_flip) and not args.apply:
        print("Planned changes (dry run):")
        if to_deactivate:
            print(f"- Deactivate {len(to_deactivate)} indicator(s) below coverage {args.deactivate_below:.0%}")
        if to_flip:
            print(f"- Flip higher_is_better for {len(to_flip)} mismatched indicator(s)")
        print("Re-run with --apply to update the database.\n")

    if args.apply and (to_deactivate or to_flip):
        if to_deactivate:
            supabase.table("indicators").update({"is_active": False}).in_("id", to_deactivate).execute()
            print(f"✓ Deactivated {len(to_deactivate)} indicator(s).")
        if to_flip:
            for ind_id, new_value in to_flip.items():
                supabase.table("indicators").update({"higher_is_better": new_value}).eq("id", ind_id).execute()
            print(f"✓ Flipped higher_is_better for {len(to_flip)} indicator(s).")

    print("Notes:")
    print("- Weight share reflects data availability (more data ⇒ higher effective weight).")
    print("- Corr(raw, norm) should be positive when higher_is_better=True and negative when False.")
    print("- A ⚠ flag means the observed correlation sign disagrees with higher_is_better.")


if __name__ == "__main__":
    main()
