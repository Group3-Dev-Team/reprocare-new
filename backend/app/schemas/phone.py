"""Kenyan phone number rule shared by every request body that collects a person's phone number."""

import re
from typing import Annotated

from pydantic import AfterValidator

# 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX or +2541XXXXXXXX. Spaces between digits are allowed.
_KENYAN_PHONE = re.compile(r"^(?:0[17]\d{8}|\+254[17]\d{8})$")
PHONE_MESSAGE = "Enter a Kenyan phone number: 07XX XXX XXX, 01XX XXX XXX, or +254 7XX XXX XXX / +254 1XX XXX XXX."


def is_kenyan_phone(value: str) -> bool:
    return bool(_KENYAN_PHONE.match(value.replace(" ", "")))


def _check_phone(value: str) -> str:
    value = value.strip()
    if not is_kenyan_phone(value):
        raise ValueError(PHONE_MESSAGE)
    return value


def _check_optional_phone(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return _check_phone(value)


def normalise_kenyan_phone(value: str) -> str:
    """One stored form for a valid Kenyan number: '0712 345 678' -> '+254712345678'."""
    digits = value.strip().replace(" ", "")
    return "+254" + digits[1:] if digits.startswith("0") else digits


def _check_optional_phone_normalised(value: str | None) -> str | None:
    checked = _check_optional_phone(value)
    return normalise_kenyan_phone(checked) if checked else None


KenyanPhone = Annotated[str, AfterValidator(_check_phone)]
OptionalKenyanPhone = Annotated[str | None, AfterValidator(_check_optional_phone)]
# Account phone numbers: validated and stored in one form so they can be used to sign in.
AccountPhone = Annotated[str | None, AfterValidator(_check_optional_phone_normalised)]
