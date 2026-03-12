#!/usr/bin/env python3
# ingestion/generate_narratives.py
# ──────────────────────────────────────────────────────────────────────────────
# Script 6 of 7 — generate and store AI narrative summaries for all countries.
#
# Calls the configured LLM (Anthropic or Ollama) once per country (latest year only)
# and stores the result in esg_summary.narrative. Skips rows that already have a narrative.
# Prerequisites: compute_summary.py must have run first (esg_summary must be populated).
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python generate_narratives.py
#   python generate_narratives.py --force   # regenerate even if narrative exists
#   python generate_narratives.py --iso2 FR  # single country
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import json
import sys
import time
from typing import Optional

from utils import get_supabase_client
from llm import LLMClient
MAX_RETRIES = 3  # max attempts per country on transient errors
MAX_NARRATIVE_LEN = 220  # matches esg_summary.narrative varchar limit
MAX_REASON_LEN = 60
MAX_CONTEXT_LEN = 80

SYSTEM = (
    "You are a senior ESG analyst. Return ONLY valid JSON.\n"
    "Use only the provided facts. Do not invent data.\n"
    "Be analytically honest: low CO2 in poor countries reflects energy poverty.\n"
    "Avoid filler words (\"demonstrates\", \"showcases\", \"boasts\", \"strives\").\n"
    "Keep each field under 12 words."
)


def build_user_prompt(
    row: dict,
    total: int,
    stats: Optional[dict],
    top_lines: list[str],
    bottom_lines: list[str],
) -> str:
    country = row["countries"]
    stats_line = "Latest macro stats: N/A"
    if stats:
        gdp_pc = stats.get("gdp_per_capita")
        pop = stats.get("population")
        stats_parts = []
        if gdp_pc:
            stats_parts.append(f"GDP per capita ${gdp_pc:,.0f}")
        if pop:
            stats_parts.append(f"Population {int(pop):,}")
        if stats_parts:
            stats_line = f"Latest macro stats (year {stats.get('year')}): " + " · ".join(stats_parts)

    return (
        f"Country: {country['name']} | Region: {country['region']} | Income: {country['income_group']}\n"
        f"Score year: {row['year']} (scores use latest available data up to this year)\n"
        f"{stats_line}\n"
        f"Scores (0–100, world avg ~64):\n"
        f"  Environmental: {_fmt(row['e_score'])} (rank {row['e_rank'] or '?'}/{total})\n"
        f"  Social:        {_fmt(row['s_score'])} (rank {row['s_rank'] or '?'}/{total})\n"
        f"  Governance:    {_fmt(row['g_score'])} (rank {row['g_rank'] or '?'}/{total})\n"
        f"  Overall ESG:   {_fmt(row['esg_score'])} (rank {row['esg_rank'] or '?'}/{total})\n\n"
        "Top indicators:\n"
        + ("\n".join(f"  - {item}" for item in top_lines) if top_lines else "  - None\n")
        + "\nLowest indicators:\n"
        + ("\n".join(f"  - {item}" for item in bottom_lines) if bottom_lines else "  - None\n")
        + "\n\nReturn ONLY this JSON object (no markdown):\n"
        "{\n"
        '  "strength_pillar": "E|S|G",\n'
        '  "strength_reason": "<short reason grounded in indicators or macro stats>",\n'
        '  "weakness_pillar": "E|S|G",\n'
        '  "weakness_reason": "<short reason grounded in indicators or macro stats>",\n'
        '  "context": "<one sentence linking scores to context>"\n'
        "}"
    )


def _fmt(v: Optional[float]) -> str:
    return f"{v:.1f}" if v is not None else "N/A"


def _pct(v: Optional[float]) -> str:
    return f"{round(v * 100):d}/100" if isinstance(v, (int, float)) else "N/A"


def load_latest_scores(supabase, country_id: int, year: int) -> list[dict]:
    result = (
        supabase.table("scores")
        .select(
            "indicator_id, year, raw_value, normalized, "
            "indicators(code, name, pillar, unit)"
        )
        .eq("country_id", country_id)
        .lte("year", year)
        .order("indicator_id", desc=False)
        .order("year", desc=True)
        .execute()
    )
    rows = result.data or []
    latest: dict[int, dict] = {}
    for row in rows:
        ind_id = row["indicator_id"]
        if ind_id not in latest:
            latest[ind_id] = row
    return list(latest.values())


def load_latest_stats(supabase, country_id: int, year: int) -> Optional[dict]:
    result = (
        supabase.table("country_stats")
        .select("year, gdp_per_capita, population, gdp_usd, source")
        .eq("country_id", country_id)
        .lte("year", year)
        .order("year", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def format_indicator(row: dict) -> str:
    ind = row.get("indicators") or {}
    code = ind.get("code") or "?"
    name = ind.get("name") or "Unknown indicator"
    score = _pct(row.get("normalized"))
    year = row.get("year")
    return f"{code} {name} — {score} (data {year})"


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in LLM response.")
    return json.loads(cleaned[start:end + 1])


def clip_text(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    trimmed = text[:limit].rstrip()
    if " " in trimmed:
        trimmed = trimmed.rsplit(" ", 1)[0]
    return trimmed.rstrip(",;:")  # keep phrase clean


def compose_narrative(payload: dict) -> str:
    strength_pillar = str(payload.get("strength_pillar", "")).strip().upper() or "E"
    weakness_pillar = str(payload.get("weakness_pillar", "")).strip().upper() or "S"
    strength_reason = clip_text(
        str(payload.get("strength_reason", "Stronger performance")).strip(),
        MAX_REASON_LEN,
    )
    weakness_reason = clip_text(
        str(payload.get("weakness_reason", "Weaker performance")).strip(),
        MAX_REASON_LEN,
    )
    context = clip_text(
        str(payload.get("context", "Context based on available indicators.")).strip(),
        MAX_CONTEXT_LEN,
    )

    pillar_map = {"E": "Environmental", "S": "Social", "G": "Governance"}
    strength_label = pillar_map.get(strength_pillar, strength_pillar)
    weakness_label = pillar_map.get(weakness_pillar, weakness_pillar)

    def build(include_context: bool) -> str:
        base = (
            f"Strength: {strength_label} — {strength_reason}. "
            f"Weakness: {weakness_label} — {weakness_reason}."
        )
        if include_context:
            return f"{base} Context: {context}."
        return base

    narrative = build(include_context=True)
    if len(narrative) <= MAX_NARRATIVE_LEN:
        return narrative

    context_short = clip_text(context, 40)
    narrative = (
        f"Strength: {strength_label} — {strength_reason}. "
        f"Weakness: {weakness_label} — {weakness_reason}. "
        f"Context: {context_short}."
    )
    if len(narrative) <= MAX_NARRATIVE_LEN:
        return narrative

    narrative = build(include_context=False)
    if len(narrative) <= MAX_NARRATIVE_LEN:
        return narrative

    strength_reason_short = clip_text(strength_reason, 40)
    weakness_reason_short = clip_text(weakness_reason, 40)
    narrative = (
        f"Strength: {strength_label} — {strength_reason_short}. "
        f"Weakness: {weakness_label} — {weakness_reason_short}."
    )
    if len(narrative) <= MAX_NARRATIVE_LEN:
        return narrative

    return f"Strength: {strength_label}. Weakness: {weakness_label}."


def load_summary_rows(
    supabase,
    force: bool = False,
    iso2_filter: Optional[str] = None,
) -> list[dict]:
    """Load esg_summary rows that need a narrative, with country metadata."""
    query = (
        supabase.table("esg_summary")
        .select(
            "id, country_id, e_score, s_score, g_score, esg_score, "
            "e_rank, s_rank, g_rank, esg_rank, year, narrative, "
            "countries(name, region, income_group, iso2)"
        )
        .order("year", desc=True)
    )

    if not force:
        query = query.is_("narrative", "null")

    if iso2_filter:
        # Filter by iso2 via the join — requires filtering post-fetch
        pass

    result = query.execute()
    rows = result.data or []

    if iso2_filter:
        iso2 = iso2_filter.upper()
        rows = [r for r in rows if r.get("countries", {}).get("iso2", "").upper() == iso2]

    # Deduplicate: keep only latest year per country
    seen: dict[str, dict] = {}
    for row in rows:
        country = row.get("countries") or {}
        region = (country.get("region") or "").strip()
        income = (country.get("income_group") or "").strip()
        iso2 = (country.get("iso2") or "").strip()
        if not region or not income:
            continue
        if len(iso2) != 2 or not iso2.isalpha():
            continue
        name = country.get("name")
        if not name:
            continue
        if name not in seen or row["year"] > seen[name]["year"]:
            seen[name] = row

    return list(seen.values())


def generate_narrative(
    client: LLMClient,
    row: dict,
    total: int,
    stats: Optional[dict],
    top_lines: list[str],
    bottom_lines: list[str],
) -> str:
    """Call the configured LLM and return the narrative string.

    Retries up to MAX_RETRIES times on transient errors.
    Uses exponential backoff: 2s, 4s, 8s between attempts.
    """
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            text = client.generate(
                system=SYSTEM,
                prompt=build_user_prompt(row, total, stats, top_lines, bottom_lines),
                max_tokens=220,
                temperature=0,
            )
            payload = extract_json(text)
            narrative = compose_narrative(payload)
            return narrative.strip()[:MAX_NARRATIVE_LEN]

        except Exception as e:
            wait = 2 ** attempt
            print(f"\n    [llm error] attempt {attempt}/{MAX_RETRIES} — {e} — sleeping {wait}s…", end="")
            time.sleep(wait)
            last_error = e

    raise last_error or RuntimeError("generate_narrative: all retries exhausted")


def save_narrative(supabase, summary_id: int, narrative: str) -> None:
    supabase.table("esg_summary").update({"narrative": narrative}).eq("id", summary_id).execute()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate AI narratives for all ESG summaries.")
    parser.add_argument("--force",    action="store_true", help="Regenerate even if narrative already exists")
    parser.add_argument("--iso2",     type=str, help="Generate for a single country by ISO2 code")
    parser.add_argument("--dry-run",  action="store_true", help="Print prompts only; no API calls or DB writes")
    args = parser.parse_args()

    supabase = get_supabase_client()
    try:
        client = LLMClient.from_env()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    rows = load_summary_rows(supabase, force=args.force, iso2_filter=args.iso2)
    total = len(rows)

    if not rows:
        print("No rows need narratives. Use --force to regenerate existing ones.")
        return

    print(f"Generating narratives for {len(rows)} countries…")
    if args.dry_run:
        print("(DRY RUN — no API calls or DB writes)\n")

    ok = 0
    errors = 0

    for i, row in enumerate(rows, start=1):
        country_name = row["countries"]["name"]
        prefix = f"  [{i:3d}/{len(rows)}] {country_name:30s}"

        if args.dry_run:
            print(f"{prefix} → (dry run)")
            print(build_user_prompt(row))
            print()
            continue

        try:
            latest_scores = load_latest_scores(supabase, row["country_id"], row["year"])
            stats = load_latest_stats(supabase, row["country_id"], row["year"])
            scored = [s for s in latest_scores if s.get("normalized") is not None]
            scored_sorted = sorted(scored, key=lambda s: s["normalized"], reverse=True)
            top_lines = [format_indicator(s) for s in scored_sorted[:3]]
            bottom_lines = [format_indicator(s) for s in scored_sorted[-3:]] if len(scored_sorted) >= 3 else []

            narrative = generate_narrative(client, row, total, stats, top_lines, bottom_lines)
            save_narrative(supabase, row["id"], narrative)
            print(f"{prefix} → \"{narrative[:70]}{'…' if len(narrative) > 70 else ''}\"")
            ok += 1

            # Small delay to avoid rate limits (Haiku tier: 50 RPM)
            if i % 10 == 0:
                time.sleep(0.5)

        except Exception as e:
            print(f"{prefix} → ERROR: {e}")
            errors += 1

    if not args.dry_run:
        print(f"\n✓ Done: {ok} generated, {errors} errors.")


if __name__ == "__main__":
    main()
