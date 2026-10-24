"""The one place the app reads the clock.

Our DateTime columns store UTC without a timezone ("naive"), so this returns the same kind
of value the deprecated datetime.utcnow() did. Comparing a timezone-aware time with a value
read from the database would raise TypeError, so always use this instead of datetime.now(UTC).
"""

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
