"""Timezone-agnostic datetime helpers.

All helpers operate against a per-request timezone supplied by
`user_context.current_tz`. Callers outside an HTTP request can pass `tz`
explicitly. The historical Eastern-specific API has been removed.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .user_context import get_current_tz

UTC = ZoneInfo("UTC")


def _resolve(tz: ZoneInfo | None) -> ZoneInfo:
    return tz if tz is not None else get_current_tz()


def now_local(tz: ZoneInfo | None = None) -> datetime:
    return datetime.now(_resolve(tz))


def utc_to_local(dt: datetime, tz: ZoneInfo | None = None) -> datetime:
    local_tz = _resolve(tz)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(local_tz)


def local_to_utc(dt: datetime, tz: ZoneInfo | None = None) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_resolve(tz))
    return dt.astimezone(UTC)


def get_local_midnight(dt: datetime, tz: ZoneInfo | None = None) -> datetime:
    local_tz = _resolve(tz)
    local_dt = utc_to_local(dt, local_tz) if dt.tzinfo else dt.replace(tzinfo=local_tz)
    return local_dt.replace(hour=0, minute=0, second=0, microsecond=0)


def get_next_local_midnight(dt: datetime, tz: ZoneInfo | None = None) -> datetime:
    local_tz = _resolve(tz)
    midnight = get_local_midnight(dt, local_tz)
    anchored = dt if dt.tzinfo else dt.replace(tzinfo=local_tz)
    if anchored >= midnight:
        midnight = midnight + timedelta(days=1)
    return midnight


def get_local_week_start(
    dt: datetime | None = None, tz: ZoneInfo | None = None
) -> datetime:
    local_tz = _resolve(tz)
    if dt is None:
        dt = now_local(local_tz)
    else:
        dt = utc_to_local(dt, local_tz) if dt.tzinfo else dt.replace(tzinfo=local_tz)

    days_since_monday = dt.weekday()
    week_start = dt - timedelta(days=days_since_monday)
    return week_start.replace(hour=0, minute=0, second=0, microsecond=0)


def split_session_at_midnight(
    start_time: datetime,
    duration_seconds: int,
    tz: ZoneInfo | None = None,
):
    """Split a session at local-midnight boundaries.

    Returns a list of (start_time, duration_seconds) tuples where each
    segment lives entirely on one local calendar day.
    """
    local_tz = _resolve(tz)
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=local_tz)
    else:
        start_time = utc_to_local(start_time, local_tz)

    end_time = start_time + timedelta(seconds=duration_seconds)

    current_midnight = get_local_midnight(start_time, local_tz)
    next_midnight = current_midnight + timedelta(days=1)

    sessions = []
    current_start = start_time

    while current_start < end_time:
        if current_start >= next_midnight:
            current_midnight = next_midnight
            next_midnight = current_midnight + timedelta(days=1)

        if end_time <= next_midnight:
            segment_end = end_time
        else:
            segment_end = next_midnight

        segment_duration = int((segment_end - current_start).total_seconds())
        if segment_duration > 0:
            sessions.append((current_start, segment_duration))

        current_start = segment_end

    return sessions


def utc_now_naive() -> datetime:
    """Current UTC time, timezone-naive — for DB columns that store naive UTC."""
    return datetime.now(UTC).replace(tzinfo=None)


def _tz_for_session(session) -> ZoneInfo:
    """Resolve the tz a session belongs to. Falls back to current ctx tz."""
    name = getattr(session, "tz", None)
    if name:
        try:
            return ZoneInfo(name)
        except Exception:
            pass
    return get_current_tz()


def session_local_date(session):
    """The calendar date this session belongs to, in its own logged tz."""
    tz = _tz_for_session(session)
    return utc_to_local(session.time, tz).date()


def session_local_week_start_date(session):
    """The Monday of the local week this session belongs to (in its own tz)."""
    tz = _tz_for_session(session)
    local = utc_to_local(session.time, tz)
    week_start = get_local_week_start(local, tz)
    return week_start.date()
