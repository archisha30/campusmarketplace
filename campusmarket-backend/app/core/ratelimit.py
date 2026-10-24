"""Tiny in-memory sliding-window rate limiter.

Good enough for a single backend instance (Render free plan). It resets when the server
restarts, which is fine: the per-account lockout in the database is the persistent guard.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request

# Forget keys with no recent attempts every this many calls, so someone sending millions of
# made-up emails or IPs can't slowly fill the server's memory.
SWEEP_EVERY = 1000


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()
        self._calls = 0

    def allow(self, key: str) -> bool:
        """Record one attempt for `key`; False if it's over the limit."""
        now = time.monotonic()
        with self._lock:
            self._calls += 1
            if self._calls % SWEEP_EVERY == 0:
                self._sweep(now)
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def _sweep(self, now: float) -> None:
        for key in [k for k, hits in self._hits.items() if not hits or now - hits[-1] > self.window]:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
            self._calls = 0


def client_ips(request: Request, proxy_hops: int) -> tuple[str, str]:
    """(edge, reported) IP addresses for per-IP limits.

    In production a request goes browser -> Vercel -> Render -> us, and each proxy appends the
    address that connected to it to X-Forwarded-For. Render only appends (it keeps whatever the
    sender put there), so only the last `proxy_hops` entries are written by Render itself:

    - edge: the address that connected to Render. Can't be faked, but for normal traffic it's
      Vercel's server, shared by every student, so it gets a generous limit.
    - reported: the entry just before it, which Vercel sets to the student's address. Someone
      calling Render directly can fake this one, but they're still held to the edge limit.

    Without the header (local development, tests) both are the connecting address.
    """
    entries = [e.strip() for e in request.headers.get("x-forwarded-for", "").split(",") if e.strip()]
    if len(entries) < proxy_hops or proxy_hops < 1:
        peer = request.client.host if request.client else "unknown"
        return peer, peer
    edge = entries[-proxy_hops]
    reported = entries[-proxy_hops - 1] if len(entries) > proxy_hops else edge
    return edge, reported
