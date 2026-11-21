"""Ranking for "Picked for you" / "More like this", done in the database.

The frontend sends how much the student likes each category (or subject), e.g.
{"Electronics": 2.0}. Scores become a SQL CASE expression, so Postgres sorts and returns only
the top few rows, instead of the server loading every listing into memory on each request
(which held a database connection for as long as the sort took, and starved others under load).
"""

import json
import math

from sqlalchemy import case

MAX_SCORED = 30  # more keys than there are categories/subjects is just noise


def parse_scores(raw: str | None, lower: bool = False) -> dict[str, float]:
    """{"Electronics": 2.0} from the query string; malformed input means "no personalization"."""
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return {}
        scores = {(str(k).lower() if lower else str(k)): float(v) for k, v in parsed.items()}
    except (ValueError, TypeError):
        return {}
    finite = {k: v for k, v in scores.items() if math.isfinite(v)}
    return dict(sorted(finite.items(), key=lambda kv: kv[1], reverse=True)[:MAX_SCORED])


def score_expression(terms: list):
    """Sum of CASE terms, or None when there's nothing to score (then sort by recency only:
    Postgres refuses a constant in ORDER BY)."""
    terms = [t for t in terms if t is not None]
    if not terms:
        return None
    total = terms[0]
    for t in terms[1:]:
        total = total + t
    return total


def affinity(column, scores: dict[str, float]):
    """CASE column WHEN 'Electronics' THEN 2.0 ... ELSE 0 END, or None without scores."""
    return case(scores, value=column, else_=0.0) if scores else None


def boost(condition, amount: float = 0.5):
    return case((condition, amount), else_=0.0)
