#!/usr/bin/env python3
# ingestion/generate_context.py
# ──────────────────────────────────────────────────────────────────────────────
# Script 7 of 7 : generate and store country context blocks.
#
# Uses the configured LLM (Anthropic or Ollama) to generate GDP per capita,
# main industries, climate zone, and a short ESG context note. Results are
# stored in the `country_context` table and shown directly in the UI.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python generate_context.py
#   python generate_context.py --force       # regenerate even if context exists
#   python generate_context.py --iso2 FR     # single country
#   python generate_context.py --year 2023   # use a specific summary year
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse
import json
import sys
import time
from datetime import datetime
from typing import Optional

from utils import get_supabase_client
from llm import LLMClient

MAX_RETRIES = 3

SYSTEM = (
    "You are a concise ESG analyst. Return ONLY valid JSON.\n"
    "Use the provided country metadata and indicator highlights.\n"
    "Keep each field short (under 12 words). If unsure, write 'Unknown'."
)


def is_sovereign(country: dict) -> bool:
    if not country:
        return False
    region = (country.get("region") or "").strip()
    income = (country.get("income_group") or "").strip()
    iso2 = (country.get("iso2") or "").strip()
    if not region or not income:
        return False
    if len(iso2) != 2 or not iso2.isalpha():
        return False
    return True


def load_summary_rows(
    supabase,
    year: Optional[int] = None,
    iso2_filter: Optional[str] = None,
) -> list[dict]:
    query = (
        supabase.table("esg_summary")
        .select(
            "id, country_id, year, e_score, s_score, g_score, esg_score, "
            "e_rank, s_rank, g_rank, esg_rank, "
            "countries(name, region, income_group, iso2)"
        )
        .order("year", desc=True)
    )
    if year:
        query = query.eq("year", year)

    rows = query.execute().data or []

    if iso2_filter:
        iso2 = iso2_filter.upper()
        rows = [r for r in rows if (r.get("countries") or {}).get("iso2", "").upper() == iso2]

    if year:
        return [r for r in rows if is_sovereign(r.get("countries") or {})]

    # Deduplicate to latest year per country
    seen: dict[str, dict] = {}
    for row in rows:
        country = row.get("countries") or {}
        if not is_sovereign(country):
            continue
        name = country.get("name")
        if not name:
            continue
        if name not in seen or row["year"] > seen[name]["year"]:
            seen[name] = row
    return list(seen.values())


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


def format_indicator(row: dict) -> str:
    ind = row.get("indicators") or {}
    code = ind.get("code") or "?"
    name = ind.get("name") or "Unknown indicator"
    norm = row.get("normalized")
    score = f"{round(norm * 100):d}/100" if isinstance(norm, (int, float)) else "N/A"
    return f"{code} {name} : {score} (data {row.get('year')})"


def build_prompt(row: dict, highlights: list[dict]) -> str:
    country = row.get("countries") or {}
    top = [h for h in highlights if h.get("normalized") is not None]
    top_sorted = sorted(top, key=lambda r: r["normalized"], reverse=True)
    top_three = [format_indicator(r) for r in top_sorted[:3]]
    bottom_three = [format_indicator(r) for r in top_sorted[-3:]] if len(top_sorted) >= 3 else []

    return (
        f"Country: {country.get('name')} ({country.get('iso2')})\n"
        f"Region: {country.get('region')} | Income: {country.get('income_group')}\n"
        f"Score year: {row.get('year')} (scores use latest available data up to this year)\n"
        f"Pillar scores (0–100): E={_fmt(row.get('e_score'))} "
        f"S={_fmt(row.get('s_score'))} G={_fmt(row.get('g_score'))} "
        f"ESG={_fmt(row.get('esg_score'))}\n\n"
        "Top indicators:\n"
        + ("\n".join(f"  - {item}" for item in top_three) if top_three else "  - None\n")
        + "\nLowest indicators:\n"
        + ("\n".join(f"  - {item}" for item in bottom_three) if bottom_three else "  - None\n")
        + "\n\nReturn ONLY this JSON object (no markdown):\n"
        "{\n"
        '  "gdp_per_capita": "<approximate GDP per capita with currency>",\n'
        '  "main_industries": "<3-5 main industries, comma-separated>",\n'
        '  "climate_zone": "<primary climate zone>",\n'
        '  "esg_context": "<one short sentence linking the data to context>"\n'
        "}"
    )


def _fmt(value: Optional[float]) -> str:
    return f"{value:.1f}" if isinstance(value, (int, float)) else "N/A"


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in LLM response.")
    return json.loads(cleaned[start:end + 1])


def truncate(value: Optional[str], limit: int) -> Optional[str]:
    if value is None:
        return None
    return str(value).strip()[:limit]


def generate_context(client: LLMClient, prompt: str) -> dict:
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            raw = client.generate(system=SYSTEM, prompt=prompt, max_tokens=200)
            return extract_json(raw)
        except Exception as exc:
            wait = 2 ** attempt
            print(f"\n    [llm error] attempt {attempt}/{MAX_RETRIES} : sleeping {wait}s…", end="")
            time.sleep(wait)
            last_error = exc
    raise last_error or RuntimeError("generate_context: all retries exhausted")


def save_context(supabase, country_id: int, payload: dict) -> None:
    supabase.table("country_context").upsert(
        {
            "country_id": country_id,
            "gdp_per_capita": truncate(payload.get("gdp_per_capita"), 80),
            "main_industries": truncate(payload.get("main_industries"), 120),
            "climate_zone": truncate(payload.get("climate_zone"), 80),
            "esg_context": truncate(payload.get("esg_context"), 220),
            "updated_at": datetime.utcnow().isoformat(),
        },
        on_conflict="country_id",
    ).execute()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and store country context blocks.")
    parser.add_argument("--force", action="store_true", help="Regenerate even if context already exists")
    parser.add_argument("--iso2", type=str, help="Generate for a single country by ISO2 code")
    parser.add_argument("--year", type=int, help="Use a specific summary year (default: latest per country)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts only; no API calls or DB writes")
    args = parser.parse_args()

    supabase = get_supabase_client()
    try:
        client = LLMClient.from_env()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    summaries = load_summary_rows(supabase, year=args.year, iso2_filter=args.iso2)
    if not summaries:
        print("No summaries found.")
        return

    existing = {
        row["country_id"]
        for row in (supabase.table("country_context").select("country_id").execute().data or [])
    }

    targets = []
    for row in summaries:
        if not args.force and row["country_id"] in existing:
            continue
        targets.append(row)

    if not targets:
        print("No rows need context. Use --force to regenerate existing ones.")
        return

    print(f"Generating context for {len(targets)} countries…")
    if args.dry_run:
        print("(DRY RUN : no API calls or DB writes)\n")

    ok = 0
    errors = 0

    for i, row in enumerate(targets, start=1):
        country = row.get("countries") or {}
        prefix = f"  [{i:3d}/{len(targets)}] {country.get('name', 'Unknown'):30s}"

        highlights = load_latest_scores(supabase, row["country_id"], row["year"])
        prompt = build_prompt(row, highlights)

        if args.dry_run:
            print(f"{prefix} → (dry run)")
            print(prompt)
            print()
            continue

        try:
            context_payload = generate_context(client, prompt)
            save_context(supabase, row["country_id"], context_payload)
            print(f"{prefix} → saved")
            ok += 1

            if i % 10 == 0:
                time.sleep(0.5)
        except Exception as exc:
            print(f"{prefix} → ERROR: {exc}")
            errors += 1

    if not args.dry_run:
        print(f"\n✓ Done: {ok} generated, {errors} errors.")


if __name__ == "__main__":
    main()
