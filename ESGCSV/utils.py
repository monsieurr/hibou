# ingestion/utils.py
# ──────────────────────────────────────────────────────────────────────────────
# Shared utilities for all Hibou ingestion scripts.
#
# CRITICAL: normalize() returns a float in the range 0.0–1.0.
# The DB column `normalized` is DECIMAL(5,4) which stores values 0.0000–9.9999.
# The entire frontend multiplies `normalized` by 100 to get a 0–100 display score.
# DO NOT return score * 100 here : that would store 100× too large and break the UI.
# ──────────────────────────────────────────────────────────────────────────────

from __future__ import annotations
import os
import sys
import math
from typing import Optional
from supabase import create_client, Client


# ── Supabase client ────────────────────────────────────────────────────────────

def get_supabase_client() -> Client:
    """Return a Supabase client using the Secret key (service role).

    The service role key bypasses RLS : required for INSERT / UPSERT / UPDATE.
    Never use the publishable (anon) key for ingestion scripts.
    """
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")  # Secret key (service role), NOT publishable

    if not url or not key:
        print(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_KEY must be set.\n"
            "SUPABASE_KEY is the Secret key (service role).\n"
            "Copy .env.local.example to .env.local and fill in your values.\n"
            "Then run: export $(grep -v '^#' .env.local | xargs)"
        )
        sys.exit(1)

    return create_client(url, key)


# ── Score normalisation ────────────────────────────────────────────────────────

def normalize(
    value: float,
    all_values: list[Optional[float]],
    higher_is_better: bool = True,
) -> float:
    """Min-max normalise a single value to the range 0.0–1.0.

    Returns 0.5 if no variance exists (all values equal or fewer than 2 valid).

    Args:
        value:            The raw value to normalise.
        all_values:       All raw values for this indicator/year (including None).
        higher_is_better: If False, invert the score (lower raw → higher normalised).

    Returns:
        A float in [0.0, 1.0] rounded to 4 decimal places.

    Note: The frontend reads this value and multiplies by 100 to display 0–100.
    The DB column `normalized` is DECIMAL(5,4) : it stores 0.0000–1.0000, NOT 0–100.
    """
    valid = [v for v in all_values if v is not None]

    if not valid or len(valid) < 2:
        return 0.5

    min_v = min(valid)
    max_v = max(valid)

    if max_v == min_v:
        return 0.5

    score = (value - min_v) / (max_v - min_v)

    if not higher_is_better:
        score = 1.0 - score

    # Clamp to [0, 1] to handle floating-point edge cases
    score = max(0.0, min(1.0, score))

    # Store as 0–1 (DECIMAL(5,4)); frontend multiplies by 100 for display
    return round(score, 4)


# ── Pillar score ───────────────────────────────────────────────────────────────

def pillar_score(normalised_values: list[Optional[float]]) -> Optional[float]:
    """Return the mean of non-None normalised scores, scaled to 0–100.

    This is what gets stored in esg_summary.e_score / s_score / g_score.
    The pillar scores ARE stored as 0–100 (unlike `scores.normalized` which is 0–1).
    """
    valid = [v for v in normalised_values if v is not None]
    if not valid:
        return None
    # normalised values are 0–1; multiply by 100 for pillar/ESG summary scores
    return round(sum(valid) / len(valid) * 100, 2)


# ── Data completeness ──────────────────────────────────────────────────────────

def is_data_complete(
    indicator_count: int,
    total_indicators: int,
    threshold_ratio: float = 7 / 9,
) -> bool:
    """Return True if enough indicators are available for a pillar.

    The default ratio (7/9) matches the original Hibou threshold.
    """
    if total_indicators <= 0:
        return False
    threshold = math.ceil(total_indicators * threshold_ratio)
    return indicator_count >= threshold
