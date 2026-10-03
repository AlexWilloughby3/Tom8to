"""Request-scoped current user timezone, carried via ContextVar."""
from contextvars import ContextVar, Token
from zoneinfo import ZoneInfo

_DEFAULT_TZ = ZoneInfo("America/New_York")

current_tz: ContextVar[ZoneInfo] = ContextVar("current_tz", default=_DEFAULT_TZ)


def get_current_tz() -> ZoneInfo:
    return current_tz.get()


def set_current_tz(tz: ZoneInfo) -> Token:
    return current_tz.set(tz)


def reset_current_tz(token: Token) -> None:
    current_tz.reset(token)


def tz_from_name(name: str | None) -> ZoneInfo:
    if not name:
        return _DEFAULT_TZ
    try:
        return ZoneInfo(name)
    except Exception:
        return _DEFAULT_TZ
