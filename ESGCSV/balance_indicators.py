#!/usr/bin/env python3
# ESGCSV/balance_indicators.py
# ──────────────────────────────────────────────────────────────────────────────
# Activate a balanced indicator set (equal counts across E/S/G) and deactivate
# the rest. This keeps scoring comparable across pillars.
#
# Usage:
#   export $(grep -v '^#' .env.local | xargs)
#   python balance_indicators.py           # dry run
#   python balance_indicators.py --apply   # apply updates
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import argparse

from utils import get_supabase_client


BALANCED_ACTIVE = {
    "E": ["E1", "E3", "E4", "E6", "E7", "E8"],
    "S": ["S2", "S4", "S7", "S8", "S13", "S15"],
    "G": ["G1", "G2", "G3", "G4", "G5", "G6"],
}


def load_indicators(supabase) -> list[dict]:
    result = supabase.table("indicators").select("id, code, pillar, is_active").execute()
    return result.data or []


def apply_updates(supabase, codes: list[str], active: bool) -> None:
    if not codes:
        return
    supabase.table("indicators").update({"is_active": active}).in_("code", codes).execute()


def main() -> None:
    parser = argparse.ArgumentParser(description="Balance active indicators across pillars.")
    parser.add_argument("--apply", action="store_true", help="Apply updates to the database")
    args = parser.parse_args()

    supabase = get_supabase_client()
    rows = load_indicators(supabase)
    if not rows:
        print("No indicators found in DB.")
        return

    active_set = {code for codes in BALANCED_ACTIVE.values() for code in codes}
    found_codes = {row["code"] for row in rows}
    missing = sorted(active_set - found_codes)

    to_activate = sorted(
        row["code"] for row in rows
        if row["code"] in active_set and not row.get("is_active", True)
    )
    to_deactivate = sorted(
        row["code"] for row in rows
        if row["code"] not in active_set and row.get("is_active", True)
    )

    print("\nBalanced indicator set (6 per pillar):")
    for pillar, codes in BALANCED_ACTIVE.items():
        print(f"  {pillar}: {', '.join(codes)}")

    if missing:
        print(f"\n⚠ Missing indicators in DB: {', '.join(missing)}")

    if not (to_activate or to_deactivate):
        print("\nNo changes needed.")
        return

    print("\nPlanned changes:")
    if to_activate:
        print(f"- Activate {len(to_activate)}: {', '.join(to_activate)}")
    if to_deactivate:
        print(f"- Deactivate {len(to_deactivate)}: {', '.join(to_deactivate)}")

    if not args.apply:
        print("\nRe-run with --apply to update the database.")
        return

    apply_updates(supabase, to_activate, True)
    apply_updates(supabase, to_deactivate, False)
    print("\n✓ Indicator activation updated.")


if __name__ == "__main__":
    main()
