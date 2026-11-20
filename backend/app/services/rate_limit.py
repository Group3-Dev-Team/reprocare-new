"""Small in-memory limiter for sign-in attempts.

It slows down password guessing against one account (or from one address) without any new table.
Counters live in the API process, so they reset on restart and are per worker; put a shared store
such as Redis behind `_attempts` if the API is ever run with several workers.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, status

MAX_FAILURES_PER_ACCOUNT = 8   # failed attempts allowed per email...
MAX_FAILURES_PER_ADDRESS = 40  # ...or per client IP (higher: offices and campuses share addresses)...
WINDOW_SECONDS = 15 * 60       # ...within this many seconds


def _limit(key: str) -> int:
    return MAX_FAILURES_PER_ADDRESS if key.startswith("ip:") else MAX_FAILURES_PER_ACCOUNT

_attempts: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def _prune(q: deque, now: float) -> None:
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()


def check(*keys: str) -> None:
    """Raise 429 if any key has too many recent failures."""
    now = time.monotonic()
    with _lock:
        for key in keys:
            q = _attempts.get(key)
            if q is None:
                continue
            _prune(q, now)
            if len(q) >= _limit(key):
                wait = int(WINDOW_SECONDS - (now - q[0])) // 60 + 1
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    f"Too many sign-in attempts. Please wait about {wait} minute{'s' if wait != 1 else ''} and try again.",
                )


def record_failure(*keys: str) -> None:
    now = time.monotonic()
    with _lock:
        for key in keys:
            q = _attempts[key]
            _prune(q, now)
            q.append(now)


def reset(*keys: str) -> None:
    with _lock:
        for key in keys:
            _attempts.pop(key, None)


def consume(key: str, limit: int, window_seconds: int, message: str) -> None:
    """counts every request (e.g. reset emails) and blocks after `limit` within the time window"""
    now = time.monotonic()
    with _lock:
        q = _attempts[key]
        # forget requests older than the window
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, message)
        q.append(now)