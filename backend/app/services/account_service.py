"""Find an account by email or phone, password reset links, and deleting an account."""

import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    AppointmentRequest,
    Notification,
    PasswordResetToken,
    ProgramRegistration,
    Review,
    SavedFacility,
    User,
    UserSession,
)
from app.schemas.phone import is_kenyan_phone, normalise_kenyan_phone
from app.services.auth_service import hash_password, hash_token
from app.services.common import notify

FORMER_MEMBER = "Former member"


def normalise_identifier(raw: str) -> tuple[str, str] | None:
    """returns ('email', ...) or ('phone', '+254...'), or None if it's neither"""
    value = raw.strip()
    if "@" in value:
        return ("email", value.lower())
    if is_kenyan_phone(value):
        return ("phone", normalise_kenyan_phone(value))
    return None


def find_user(db: Session, identifier: str) -> User | None:
    parsed = normalise_identifier(identifier)
    if parsed is None:
        return None
    kind, value = parsed
    column = func.lower(User.email) if kind == "email" else User.phone
    # deleted accounts can't be found
    return db.scalar(select(User).where(column == value, User.deleted_at.is_(None)))


# ---- password reset ----

def reset_link(token: str) -> str:
    path = f"/reset-password?token={token}"
    return f"{settings.frontend_url}/#{path}" if settings.frontend_hash_urls else f"{settings.frontend_url}{path}"


def create_reset_token(db: Session, user: User) -> str:
    """new reset token for the user. old links stop working. we only save the hash"""
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_minutes)
    db.add(PasswordResetToken(user_id=user.id, token_hash=hash_token(token), expires_at=expires))
    db.commit()
    return token


def use_reset_token(db: Session, token: str, new_password: str) -> User | None:
    """sets the new password if the link is valid, not used and not expired. returns None if not"""
    now = datetime.now(timezone.utc)
    row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token)).with_for_update())
    if row is None or row.used_at is not None or row.expires_at < now:
        return None
    user = db.get(User, row.user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        return None
    user.password_hash = hash_password(new_password)
    row.used_at = now
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.id != row.id))
    # sign out on all devices
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()
    return user


# ---- deleting an account ----

def delete_account(db: Session, user: User) -> None:
    """removes the person's details. keeps anonymous records the clinics still need"""
    today = date.today()
    appointments = db.scalars(select(AppointmentRequest).where(AppointmentRequest.user_id == user.id)).all()
    for a in appointments:
        # cancel pending and upcoming appointments and tell the clinic
        if a.status == "requested" or (a.status == "confirmed" and a.preferred_date >= today):
            a.status = "cancelled"
            for staff in db.scalars(select(User).where(User.facility_id == a.facility_id, User.is_active.is_(True))):
                notify(db, staff.id, "Request cancelled: account deleted", f"{a.reference} was cancelled because the patient deleted their account.", "/dashboard/facility/appointments")
        a.contact_phone = ""
        a.notes = ""

    for r in db.scalars(select(ProgramRegistration).where(ProgramRegistration.user_id == user.id)):
        if r.status == "registered":
            r.status = "cancelled"
        r.full_name = FORMER_MEMBER
        r.phone = ""

    # reviews stay but show "Former member"
    for review in db.scalars(select(Review).where(Review.user_id == user.id)):
        review.author_name = FORMER_MEMBER
        review.user_id = None

    for model in (SavedFacility, Notification, UserSession, PasswordResetToken):
        db.execute(delete(model).where(model.user_id == user.id))

    user.full_name = FORMER_MEMBER
    user.email = f"deleted-{user.id}-{secrets.token_hex(4)}@deleted.invalid"
    user.phone = None
    user.password_hash = hash_password(secrets.token_urlsafe(24))  # random password nobody knows
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    db.commit()