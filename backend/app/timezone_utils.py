"""Timezone utilities for handling Eastern Time (EST/EDT)"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Eastern timezone
EASTERN = ZoneInfo("America/New_York")


def get_eastern_now() -> datetime:
    """Get current time in Eastern timezone"""
    return datetime.now(EASTERN)


def utc_to_eastern(dt: datetime) -> datetime:
    """Convert UTC datetime to Eastern timezone"""
    if dt.tzinfo is None:
        # Assume UTC if no timezone info
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(EASTERN)


def eastern_to_utc(dt: datetime) -> datetime:
    """Convert Eastern datetime to UTC"""
    if dt.tzinfo is None:
        # Assume Eastern if no timezone info
        dt = dt.replace(tzinfo=EASTERN)
    return dt.astimezone(ZoneInfo("UTC"))


def get_eastern_midnight(dt: datetime) -> datetime:
    """Get midnight (00:00:00) in Eastern time for the given datetime"""
    eastern_dt = utc_to_eastern(dt) if dt.tzinfo else dt.replace(tzinfo=EASTERN)
    return eastern_dt.replace(hour=0, minute=0, second=0, microsecond=0)


def get_next_eastern_midnight(dt: datetime) -> datetime:
    """Get next midnight (00:00:00) in Eastern time after the given datetime"""
    midnight = get_eastern_midnight(dt)
    if dt.replace(tzinfo=EASTERN) if dt.tzinfo is None else dt >= midnight:
        midnight = midnight + timedelta(days=1)
    return midnight


def get_eastern_week_start(dt: datetime = None) -> datetime:
    """Get the start of the week (Monday 00:00:00) in Eastern time"""
    if dt is None:
        dt = get_eastern_now()
    else:
        dt = utc_to_eastern(dt) if dt.tzinfo else dt.replace(tzinfo=EASTERN)

    # Calculate Monday of current week
    days_since_monday = dt.weekday()
    week_start = dt - timedelta(days=days_since_monday)
    return week_start.replace(hour=0, minute=0, second=0, microsecond=0)


def split_session_at_midnight(start_time: datetime, duration_seconds: int):
    """
    Split a session into multiple sessions if it crosses midnight(s) in Eastern time.

    Returns a list of tuples: [(start_time, duration_seconds), ...]
    """
    # Ensure start_time is timezone-aware (Eastern)
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=EASTERN)
    else:
        start_time = utc_to_eastern(start_time)

    end_time = start_time + timedelta(seconds=duration_seconds)

    # Get midnight boundaries
    current_midnight = get_eastern_midnight(start_time)
    next_midnight = current_midnight + timedelta(days=1)

    sessions = []

    current_start = start_time

    while current_start < end_time:
        # Find the next midnight after current_start
        if current_start >= next_midnight:
            current_midnight = next_midnight
            next_midnight = current_midnight + timedelta(days=1)

        # Determine the end of this segment
        if end_time <= next_midnight:
            # Session ends before next midnight
            segment_end = end_time
        else:
            # Session crosses midnight, split at midnight
            segment_end = next_midnight

        # Calculate duration for this segment
        segment_duration = int((segment_end - current_start).total_seconds())

        if segment_duration > 0:
            sessions.append((current_start, segment_duration))

        # Move to next segment
        current_start = segment_end

    return sessions
