"""Unit tests for timezone-agnostic helpers + user_context ContextVar.

These tests do not require a DB — they exercise the pure functions in
`app.timezone_utils` against several IANA timezones, and verify that
`app.user_context` correctly carries the current tz through helpers that
default to it.
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app import timezone_utils, user_context

TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "Europe/London",
    "Asia/Tokyo",
]


@pytest.fixture
def reset_tz():
    """Reset the ContextVar back to the default after each test."""
    token = user_context.current_tz.set(ZoneInfo("America/New_York"))
    yield
    user_context.current_tz.reset(token)


@pytest.mark.parametrize("tz_name", TIMEZONES)
def test_get_local_midnight_is_local_midnight(tz_name):
    tz = ZoneInfo(tz_name)
    sample = datetime(2026, 3, 15, 14, 37, 12, tzinfo=tz)
    midnight = timezone_utils.get_local_midnight(sample, tz)
    assert midnight.tzinfo.key == tz_name
    assert midnight.hour == 0 and midnight.minute == 0 and midnight.second == 0
    assert midnight.date() == sample.date()


@pytest.mark.parametrize("tz_name", TIMEZONES)
def test_local_to_utc_round_trip(tz_name):
    tz = ZoneInfo(tz_name)
    sample = datetime(2026, 6, 15, 23, 30, 0, tzinfo=tz)
    utc = timezone_utils.local_to_utc(sample, tz)
    assert utc.tzinfo.key == "UTC"
    assert timezone_utils.utc_to_local(utc, tz) == sample


def test_split_session_central_at_eastern_midnight(reset_tz):
    """A 30-min Central session ending 11:15pm Central spans 22:45-23:15 Central.
    It does NOT cross local midnight, so it must NOT be split — even though
    it does cross midnight in Eastern. This is the bug we just fixed."""
    central = ZoneInfo("America/Chicago")
    end = datetime(2026, 6, 15, 23, 15, 0, tzinfo=central)
    start = end - timedelta(seconds=1800)
    segments = timezone_utils.split_session_at_midnight(start, 1800, central)
    assert len(segments) == 1
    assert segments[0][1] == 1800


@pytest.mark.parametrize("tz_name", TIMEZONES)
def test_split_session_actual_local_midnight_crossing(tz_name):
    tz = ZoneInfo(tz_name)
    # End at 00:15 local, 30 min duration → starts 23:45 prior day
    end = datetime(2026, 6, 16, 0, 15, 0, tzinfo=tz)
    start = end - timedelta(seconds=1800)
    segments = timezone_utils.split_session_at_midnight(start, 1800, tz)
    assert len(segments) == 2
    assert segments[0][1] == 900  # 23:45 -> 00:00 local
    assert segments[1][1] == 900  # 00:00 -> 00:15 local
    # Each segment lives on a single local calendar day
    assert (segments[0][0]).astimezone(tz).date() != (
        segments[1][0]
    ).astimezone(tz).date()


def test_context_var_default(reset_tz):
    assert user_context.get_current_tz().key == "America/New_York"


def test_context_var_drives_now_local(reset_tz):
    tokyo = ZoneInfo("Asia/Tokyo")
    user_context.set_current_tz(tokyo)
    now = timezone_utils.now_local()
    assert now.tzinfo.key == "Asia/Tokyo"


def test_tz_from_name_invalid_falls_back(reset_tz):
    assert user_context.tz_from_name("Not/A_Real_Zone").key == "America/New_York"
    assert user_context.tz_from_name(None).key == "America/New_York"
    assert user_context.tz_from_name("").key == "America/New_York"


def test_tz_from_name_valid(reset_tz):
    assert user_context.tz_from_name("Europe/London").key == "Europe/London"


def test_get_local_week_start_is_monday(reset_tz):
    central = ZoneInfo("America/Chicago")
    # 2026-06-17 is a Wednesday
    wednesday = datetime(2026, 6, 17, 14, 30, 0, tzinfo=central)
    monday = timezone_utils.get_local_week_start(wednesday, central)
    assert monday.weekday() == 0
    assert monday.hour == 0 and monday.minute == 0
    assert (wednesday.date() - monday.date()).days == 2


# --- Per-session tz bucketing -------------------------------------------------
# These exercise the property that a session row's local-day bucket is
# determined by ITS OWN logged tz, not by whatever tz the caller is currently
# in. That's the invariant goal-completion history relies on.


class _StubSession:
    """Mimics models.FocusInformation fields used by the bucketing helpers."""

    def __init__(self, time, tz, focus_time_seconds=900, category="Work"):
        self.time = time
        self.tz = tz
        self.focus_time_seconds = focus_time_seconds
        self.category = category


def test_session_local_date_pins_to_logged_tz(reset_tz):
    # End-of-segment UTC corresponding to 2026-04-04 23:50 America/New_York.
    # That's 2026-04-05 03:50 UTC.
    utc_time = datetime(2026, 4, 5, 3, 50, 0)
    session = _StubSession(time=utc_time, tz="America/New_York")

    # Caller is now in Chicago, but the session must still bucket on Apr 4.
    user_context.set_current_tz(ZoneInfo("America/Chicago"))
    assert timezone_utils.session_local_date(session) == date(2026, 4, 4)


def test_session_local_date_uses_ctx_when_tz_missing(reset_tz):
    # Legacy row without a tz value should fall back to the current ctx tz.
    utc_time = datetime(2026, 4, 5, 3, 50, 0)
    session = _StubSession(time=utc_time, tz=None)

    user_context.set_current_tz(ZoneInfo("America/Chicago"))
    # 2026-04-05 03:50 UTC == 2026-04-04 22:50 CDT (UTC-5 during DST)
    assert timezone_utils.session_local_date(session) == date(2026, 4, 4)


def test_session_local_week_start_pins_to_logged_tz(reset_tz):
    # Sunday 2026-04-05 23:50 America/New_York → 2026-04-06 03:50 UTC.
    # That belongs to the week of Mon 2026-03-30 in EST.
    utc_time = datetime(2026, 4, 6, 3, 50, 0)
    session = _StubSession(time=utc_time, tz="America/New_York")

    user_context.set_current_tz(ZoneInfo("Asia/Tokyo"))
    assert timezone_utils.session_local_week_start_date(session) == date(
        2026, 3, 30
    )


def test_tz_change_does_not_rebucket_history(reset_tz):
    """The motivating regression: every-other-day late-night EST sessions
    must keep their EST calendar days after the user moves to Chicago."""
    # Two sessions in EST, each 15 minutes ending just past midnight.
    # First ends 2026-04-05 00:15 EST (= 2026-04-05 04:15 UTC).
    # Second ends 2026-04-07 00:15 EST (= 2026-04-07 04:15 UTC).
    s1 = _StubSession(
        time=datetime(2026, 4, 5, 4, 15, 0), tz="America/New_York"
    )
    s2 = _StubSession(
        time=datetime(2026, 4, 7, 4, 15, 0), tz="America/New_York"
    )

    user_context.set_current_tz(ZoneInfo("America/Chicago"))
    # Despite caller being in Chicago — where the same UTC moments map to
    # 2026-04-04 and 2026-04-06 locally — both sessions stay on their
    # original EST calendar days.
    assert timezone_utils.session_local_date(s1) == date(2026, 4, 5)
    assert timezone_utils.session_local_date(s2) == date(2026, 4, 7)
