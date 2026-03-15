#!/usr/bin/env python3
# ingestion/compute_summary.py
# ──────────────────────────────────────────────────────────────────────────────
# Script 5 of 7 : compute percentile scores, pillar/ESG scores and ranks,
# flag data completeness, and upsert into esg_summary.
#
# This script reads from `scores`, writes percentile values back, and
# populates `esg_summary` per (country, year).
#
# Idempotent: safe to re-run. esg_summary is fully regenerable from scores.
# Prerequisites: scripts 1–3 must have run first (scores table must have data).
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python ingestion/compute_summary.py
#   python ingestion/compute_summary.py --year 2023  # process one year only
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import sys
from collections import defaultdict
from typing import Optional

from utils import get_supabase_client, is_data_complete

# Recency half-life for indicator carry-forward
HALF_LIFE_YEARS = 5.0
COMPLETENESS_RATIO = 7 / 9


def load_all_scores(supabase) -> list[dict]:
    """Load all scores with their indicator metadata from the DB."""
    PAGE = 1000
    offset = 0
    rows: list[dict] = []

    while True:
        query = (
            supabase.table("scores")
            .select("id, country_id, indicator_id, year, raw_value, indicators(code, pillar, higher_is_better, is_active)")
        )
        result = query.range(offset, offset + PAGE - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    return rows


def load_country_meta(supabase) -> tuple[list[int], dict[int, str]]:
    result = supabase.table("countries").select("id, region, income_group, iso2").execute()
    ids: list[int] = []
    income_map: dict[int, str] = {}
    for row in (result.data or []):
        region = (row.get("region") or "").strip()
        income = (row.get("income_group") or "").strip()
        iso2 = (row.get("iso2") or "").strip()
        if not region or not income:
            continue
        if len(iso2) != 2 or not iso2.isalpha():
            continue
        ids.append(row["id"])
        income_map[row["id"]] = income
    return ids, income_map


def load_indicator_totals(supabase) -> dict[str, int]:
    """Count active indicators per pillar (E/S/G)."""
    result = supabase.table("indicators").select("pillar, is_active").execute()
    counts = {"E": 0, "S": 0, "G": 0}
    for row in (result.data or []):
        pillar = row.get("pillar")
        active = row.get("is_active", True)
        if pillar in counts and active:
            counts[pillar] += 1
    return counts


def _percentile_map(values: list[float]) -> dict[float, float]:
    """Return value → percentile (0–1) using average rank for ties."""
    n = len(values)
    if n < 2:
        return {}

    sorted_vals = sorted(values)
    value_to_pct: dict[float, float] = {}
    i = 0
    while i < n:
        val = sorted_vals[i]
        j = i + 1
        while j < n and sorted_vals[j] == val:
            j += 1
        avg_rank = (i + (j - 1)) / 2
        value_to_pct[val] = avg_rank / (n - 1)
        i = j
    return value_to_pct


def compute_percentile_scores(
    raw_scores: list[dict],
    income_map: dict[int, str],
) -> tuple[dict[int, float], dict[int, float]]:
    """
    Compute percentile-normalized scores.

    Returns:
      - global_norm: score_id → percentile (0–1) across all countries
      - peer_norm:   score_id → percentile (0–1) within income group
    """
    by_ind_year: dict[tuple, list[tuple]] = defaultdict(list)
    by_ind_year_income: dict[tuple, list[tuple]] = defaultdict(list)
    higher_global: dict[tuple, bool] = {}
    higher_peer: dict[tuple, bool] = {}

    for s in raw_scores:
        raw_value = s.get("raw_value")
        if raw_value is None:
            continue
        ind_meta = s.get("indicators", {}) or {}
        higher = ind_meta.get("higher_is_better", True) if ind_meta else True
        key = (s["indicator_id"], s["year"])
        by_ind_year[key].append((s["id"], raw_value))
        higher_global.setdefault(key, higher)

        income = income_map.get(s["country_id"])
        if income:
            key_peer = (s["indicator_id"], s["year"], income)
            by_ind_year_income[key_peer].append((s["id"], raw_value))
            higher_peer.setdefault(key_peer, higher)

    global_norm: dict[int, float] = {}
    for key, rows in by_ind_year.items():
        higher = higher_global.get(key, True)
        values = [v for _sid, v in rows]
        if len(values) < 2:
            for score_id, _value in rows:
                global_norm[score_id] = 0.5
            continue
        value_to_pct = _percentile_map(values)
        for score_id, value in rows:
            pct = value_to_pct.get(value, 0.5)
            if not higher:
                pct = 1.0 - pct
            global_norm[score_id] = round(pct, 4)

    peer_norm: dict[int, float] = {}
    for key, rows in by_ind_year_income.items():
        higher = higher_peer.get(key, True)
        values = [v for _sid, v in rows]
        if len(values) < 2:
            for score_id, _value in rows:
                peer_norm[score_id] = 0.5
            continue
        value_to_pct = _percentile_map(values)
        for score_id, value in rows:
            pct = value_to_pct.get(value, 0.5)
            if not higher:
                pct = 1.0 - pct
            peer_norm[score_id] = round(pct, 4)

    return global_norm, peer_norm


def update_normalised_values(
    supabase,
    score_id_to_norm: dict[int, float],
    raw_scores: list[dict],
) -> None:
    """Batch-upsert normalized values in the scores table.

    PostgREST validates NOT NULL columns before ON CONFLICT runs, so we must
    include required fields in each upsert row (country_id, indicator_id, year).
    """
    print(f"\nUpdating {len(score_id_to_norm)} normalised values in scores table…")

    score_by_id = {s["id"]: s for s in raw_scores}

    # Build rows with required fields to avoid NOT NULL violations
    updates = []
    for score_id, norm in score_id_to_norm.items():
        src = score_by_id.get(score_id)
        if not src:
            continue
        updates.append({
            "id": score_id,
            "country_id": src["country_id"],
            "indicator_id": src["indicator_id"],
            "year": src["year"],
            "raw_value": src.get("raw_value"),
            "normalized": norm,
        })

    BATCH = 500
    total = len(updates)
    for i in range(0, total, BATCH):
        batch = updates[i : i + BATCH]
        supabase.table("scores").upsert(
            batch,
            on_conflict="id",          # update existing row by PK
        ).execute()
        pct = min(100, round((i + len(batch)) / total * 100))
        print(f"  Progress: {i + len(batch)}/{total} ({pct}%)", end="\r")

    print(f"\n  ✓ Normalised values written ({total} rows in {((total - 1) // BATCH) + 1} batches).")


def recency_weight(age: int) -> float:
    """Weight older data less using a half-life curve."""
    return 0.5 ** (age / HALF_LIFE_YEARS)


def apply_coverage(raw: Optional[float], coverage: float, count: int) -> Optional[float]:
    """Blend scores toward neutral when coverage is low.

    Missing indicators are treated as neutral (50), so coverage acts as a
    confidence weight instead of pushing scores toward zero.
    """
    if raw is None or count == 0:
        return None
    return round(raw * coverage + 50.0 * (1 - coverage), 2)


def compute_summaries(
    raw_scores: list[dict],
    global_norm: dict[int, float],
    peer_norm: dict[int, float],
    years: list[int],
    indicator_totals: dict[str, int],
) -> list[dict]:
    """
    Compute esg_summary rows for each (country_id, year), carrying forward the
    most recent indicator value and down-weighting by age.
    """
    # Map indicator_id -> pillar
    indicator_pillar: dict[int, str] = {}
    for s in raw_scores:
        ind_meta = s.get("indicators", {}) or {}
        pillar = ind_meta.get("pillar")
        if pillar and s["indicator_id"] not in indicator_pillar:
            indicator_pillar[s["indicator_id"]] = pillar

    # Build (country_id, indicator_id) -> list of (year, global_norm, peer_norm, pillar)
    by_country_indicator: dict[tuple, list[tuple]] = defaultdict(list)
    for s in raw_scores:
        norm_global = global_norm.get(s["id"])
        if norm_global is None:
            continue
        norm_peer = peer_norm.get(s["id"])
        pillar = indicator_pillar.get(s["indicator_id"])
        if not pillar:
            continue
        by_country_indicator[(s["country_id"], s["indicator_id"])].append(
            (s["year"], norm_global, norm_peer, pillar)
        )

    for key, lst in by_country_indicator.items():
        lst.sort(key=lambda x: x[0])

    country_ids = sorted({cid for (cid, _ind) in by_country_indicator.keys()})

    summaries: list[dict] = []

    for country_id in country_ids:
        indicator_lists = {
            ind_id: lst
            for (cid, ind_id), lst in by_country_indicator.items()
            if cid == country_id
        }
        if not indicator_lists:
            continue

        pointers = {ind_id: 0 for ind_id in indicator_lists}
        last_norm: dict[int, Optional[float]] = {ind_id: None for ind_id in indicator_lists}
        last_peer: dict[int, Optional[float]] = {ind_id: None for ind_id in indicator_lists}
        last_year: dict[int, Optional[int]] = {ind_id: None for ind_id in indicator_lists}
        pillar_by_indicator = {ind_id: lst[0][3] for ind_id, lst in indicator_lists.items()}

        for year in years:
            sums = {"E": 0.0, "S": 0.0, "G": 0.0}
            sums_peer = {"E": 0.0, "S": 0.0, "G": 0.0}
            weights = {"E": 0.0, "S": 0.0, "G": 0.0}
            weights_peer = {"E": 0.0, "S": 0.0, "G": 0.0}
            counts = {"E": 0, "S": 0, "G": 0}

            for ind_id, lst in indicator_lists.items():
                idx = pointers[ind_id]
                while idx < len(lst) and lst[idx][0] <= year:
                    last_year[ind_id] = lst[idx][0]
                    last_norm[ind_id] = lst[idx][1]
                    last_peer[ind_id] = lst[idx][2]
                    idx += 1
                pointers[ind_id] = idx

                if last_norm[ind_id] is None or last_year[ind_id] is None:
                    continue

                age = year - last_year[ind_id]
                weight = recency_weight(age)
                pillar = pillar_by_indicator[ind_id]
                sums[pillar] += last_norm[ind_id] * weight
                weights[pillar] += weight
                counts[pillar] += 1

                if last_peer[ind_id] is not None:
                    sums_peer[pillar] += last_peer[ind_id] * weight
                    weights_peer[pillar] += weight

            e_raw = round((sums["E"] / weights["E"]) * 100, 2) if weights["E"] > 0 else None
            s_raw = round((sums["S"] / weights["S"]) * 100, 2) if weights["S"] > 0 else None
            g_raw = round((sums["G"] / weights["G"]) * 100, 2) if weights["G"] > 0 else None

            e_peer_raw = round((sums_peer["E"] / weights_peer["E"]) * 100, 2) if weights_peer["E"] > 0 else None
            s_peer_raw = round((sums_peer["S"] / weights_peer["S"]) * 100, 2) if weights_peer["S"] > 0 else None
            g_peer_raw = round((sums_peer["G"] / weights_peer["G"]) * 100, 2) if weights_peer["G"] > 0 else None

            coverage_e = (counts["E"] / indicator_totals.get("E", 0)) if indicator_totals.get("E", 0) > 0 else 0.0
            coverage_s = (counts["S"] / indicator_totals.get("S", 0)) if indicator_totals.get("S", 0) > 0 else 0.0
            coverage_g = (counts["G"] / indicator_totals.get("G", 0)) if indicator_totals.get("G", 0) > 0 else 0.0
            total_indicators = sum(indicator_totals.values()) or 0
            esg_coverage = (
                (coverage_e * indicator_totals.get("E", 0)) +
                (coverage_s * indicator_totals.get("S", 0)) +
                (coverage_g * indicator_totals.get("G", 0))
            ) / total_indicators if total_indicators > 0 else 0.0

            e_score = apply_coverage(e_raw, coverage_e, counts["E"])
            s_score = apply_coverage(s_raw, coverage_s, counts["S"])
            g_score = apply_coverage(g_raw, coverage_g, counts["G"])

            e_score_peer = apply_coverage(e_peer_raw, coverage_e, counts["E"])
            s_score_peer = apply_coverage(s_peer_raw, coverage_s, counts["S"])
            g_score_peer = apply_coverage(g_peer_raw, coverage_g, counts["G"])

            pillar_scores_raw = [p for p in [e_raw, s_raw, g_raw] if p is not None]
            esg_raw = round(sum(pillar_scores_raw) / len(pillar_scores_raw), 2) if len(pillar_scores_raw) == 3 else None
            esg_score = apply_coverage(esg_raw, esg_coverage, sum(counts.values()))

            pillar_scores_peer_raw = [p for p in [e_peer_raw, s_peer_raw, g_peer_raw] if p is not None]
            esg_peer_raw = round(sum(pillar_scores_peer_raw) / len(pillar_scores_peer_raw), 2) if len(pillar_scores_peer_raw) == 3 else None
            esg_score_peer = apply_coverage(esg_peer_raw, esg_coverage, sum(counts.values()))

            data_complete = (
                is_data_complete(counts["E"], indicator_totals.get("E", 0), COMPLETENESS_RATIO) and
                is_data_complete(counts["S"], indicator_totals.get("S", 0), COMPLETENESS_RATIO) and
                is_data_complete(counts["G"], indicator_totals.get("G", 0), COMPLETENESS_RATIO)
            )

            summaries.append({
                "country_id":          country_id,
                "year":                year,
                "e_score":             e_score,
                "s_score":             s_score,
                "g_score":             g_score,
                "esg_score":           esg_score,
                "e_score_peer":        e_score_peer,
                "s_score_peer":        s_score_peer,
                "g_score_peer":        g_score_peer,
                "esg_score_peer":      esg_score_peer,
                "e_indicators_count":  counts["E"],
                "s_indicators_count":  counts["S"],
                "g_indicators_count":  counts["G"],
                "e_coverage":          round(coverage_e, 4),
                "s_coverage":          round(coverage_s, 4),
                "g_coverage":          round(coverage_g, 4),
                "esg_coverage":        round(esg_coverage, 4),
                "data_complete":       data_complete,
                # Ranks computed below; narrative preserved by upsert
            })

    return summaries


def assign_ranks(summaries: list[dict], income_map: dict[int, str]) -> list[dict]:
    """
    Assign e_rank, s_rank, g_rank, esg_rank within each year group.
    Peer ranks are assigned within income group per year.
    Countries with no score for a pillar receive None rank.
    """
    # ── Global ranks (all countries per year) ────────────────────────────────
    by_year: dict[int, list[dict]] = defaultdict(list)
    for s in summaries:
        by_year[s["year"]].append(s)

    for _year, group in by_year.items():
        for pillar_key, rank_key in [
            ("e_score",   "e_rank"),
            ("s_score",   "s_rank"),
            ("g_score",   "g_rank"),
            ("esg_score", "esg_rank"),
        ]:
            ranked = sorted(
                [s for s in group if s.get(pillar_key) is not None],
                key=lambda x: x[pillar_key],
                reverse=True,
            )
            for i, s in enumerate(ranked, start=1):
                s[rank_key] = i
            for s in group:
                if rank_key not in s:
                    s[rank_key] = None

    # ── Peer ranks (within income group per year) ────────────────────────────
    by_year_income: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for s in summaries:
        income = income_map.get(s["country_id"])
        if income:
            by_year_income[(s["year"], income)].append(s)

    for _key, group in by_year_income.items():
        for pillar_key, rank_key in [
            ("e_score_peer",   "e_rank_peer"),
            ("s_score_peer",   "s_rank_peer"),
            ("g_score_peer",   "g_rank_peer"),
            ("esg_score_peer", "esg_rank_peer"),
        ]:
            ranked = sorted(
                [s for s in group if s.get(pillar_key) is not None],
                key=lambda x: x[pillar_key],
                reverse=True,
            )
            for i, s in enumerate(ranked, start=1):
                s[rank_key] = i
            for s in group:
                if rank_key not in s:
                    s[rank_key] = None

    for s in summaries:
        for rank_key in ["e_rank_peer", "s_rank_peer", "g_rank_peer", "esg_rank_peer"]:
            if rank_key not in s:
                s[rank_key] = None

    return summaries


def upsert_summaries(supabase, summaries: list[dict]) -> None:
    print(f"\nUpserting {len(summaries)} esg_summary rows…")
    BATCH = 200
    for i in range(0, len(summaries), BATCH):
        batch = summaries[i : i + BATCH]
        supabase.table("esg_summary").upsert(
            batch, on_conflict="country_id,year"
        ).execute()
        pct = min(100, round((i + len(batch)) / len(summaries) * 100))
        print(f"  Progress: {i + len(batch)}/{len(summaries)} ({pct}%)", end="\r")
    print(f"\n  ✓ esg_summary updated.")


def print_coverage_report(summaries: list[dict], supabase, indicator_totals: dict[str, int]) -> None:
    """Print a coverage summary: incomplete countries per year."""
    country_names = {
        row["id"]: row["name"]
        for row in (supabase.table("countries").select("id, name").execute().data or [])
    }

    print("\n── Coverage Report ─────────────────────────────────────────────")
    by_year: dict[int, list[dict]] = defaultdict(list)
    for s in summaries:
        by_year[s["year"]].append(s)

    for year in sorted(by_year.keys(), reverse=True):
        group = by_year[year]
        complete   = sum(1 for s in group if s["data_complete"])
        incomplete = len(group) - complete
        print(f"  {year}: {len(group)} countries : {complete} complete, {incomplete} incomplete")

    incomplete_total = [s for s in summaries if not s["data_complete"]]
    if incomplete_total:
        print(f"\n  Countries with data_complete=False (sample, latest year):")
        latest = max(by_year.keys())
        for s in sorted(by_year[latest], key=lambda x: x.get("esg_score") or 0):
            if not s["data_complete"]:
                name = country_names.get(s["country_id"], f"id={s['country_id']}")
                total_e = indicator_totals.get("E", 0)
                total_s = indicator_totals.get("S", 0)
                total_g = indicator_totals.get("G", 0)
                print(
                    f"    {name:30s}  "
                    f"E:{s['e_indicators_count']:2d}/{total_e}  "
                    f"S:{s['s_indicators_count']:2d}/{total_s}  "
                    f"G:{s['g_indicators_count']:2d}/{total_g}"
                )
    print("────────────────────────────────────────────────────────────────")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute percentile scores and ESG summaries.")
    parser.add_argument("--year", type=int, help="Process only this year (default: all years)")
    parser.add_argument("--skip-normalize", action="store_true", help="Skip writing normalised values back to scores table")
    parser.add_argument("--min-year", type=int, help="Minimum year to include")
    parser.add_argument("--max-year", type=int, help="Maximum year to include")
    args = parser.parse_args()

    supabase = get_supabase_client()

    print("Loading scores from DB…")
    raw_scores = load_all_scores(supabase)
    print(f"  {len(raw_scores)} score rows loaded.")

    if not raw_scores:
        print("No scores found. Run ingest_worldbank.py and ingest_owid.py first.")
        sys.exit(1)

    all_country_ids, income_map = load_country_meta(supabase)
    allowed_ids = set(all_country_ids)

    if args.min_year is not None or args.max_year is not None or args.year is not None:
        min_year = args.min_year if args.min_year is not None else -10**9
        max_year = args.max_year if args.max_year is not None else (args.year if args.year is not None else 10**9)
        raw_scores = [s for s in raw_scores if min_year <= s["year"] <= max_year]

    raw_scores = [s for s in raw_scores if s["country_id"] in allowed_ids]
    raw_scores = [
        s for s in raw_scores
        if (s.get("indicators") or {}).get("is_active", True)
    ]

    print("\nComputing percentile values (per indicator per year)…")
    score_id_to_norm, score_id_to_peer = compute_percentile_scores(raw_scores, income_map)
    print(f"  {len(score_id_to_norm)} percentile values computed.")

    if not args.skip_normalize:
        update_normalised_values(supabase, score_id_to_norm, raw_scores)

    print("\nAggregating pillar and ESG scores…")
    if args.year is not None:
        years = [args.year]
    else:
        years = sorted({s["year"] for s in raw_scores})
    indicator_totals = load_indicator_totals(supabase)
    summaries = compute_summaries(raw_scores, score_id_to_norm, score_id_to_peer, years, indicator_totals)
    summaries = assign_ranks(summaries, income_map)
    print(f"  {len(summaries)} (country, year) summaries computed.")

    upsert_summaries(supabase, summaries)
    print_coverage_report(summaries, supabase, indicator_totals)
    print("\n✓ compute_summary.py complete.")


if __name__ == "__main__":
    main()
