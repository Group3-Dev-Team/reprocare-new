"""Registration, sign-in (email or phone), sign-out, password reset and the signed-in user's own account."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import User
from app.config import settings
from app.schemas.auth import (
    DeleteAccountRequest,
    ForgotPasswordRequest,
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.services import mailer_service, rate_limit
from app.services.account_service import create_reset_token, delete_account, find_user, normalise_identifier, reset_link, use_reset_token
from app.services.auth_service import (
    create_session,
    demo_accounts_blocked,
    end_other_sessions,
    end_session,
    get_current_user,
    get_session_token,
    hash_password,
    user_to_dict,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if email.endswith("@reprocare.demo"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This email domain is reserved for demonstration accounts.")
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Sign in instead.")
    # phone must not belong to another account
    if body.phone and db.scalar(select(User.id).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this phone number already exists. Sign in instead, or leave the phone number empty.")
    # Public registration always creates a patient account. Staff and admin accounts are created by an administrator.
    user = User(email=email, full_name=body.full_name.strip(), phone=body.phone, password_hash=hash_password(body.password), role="patient")
    db.add(user)
    db.commit()
    return {"token": create_session(db, user), "user": user_to_dict(user)}


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # sign in with email or phone (e.g. 0712 345 678)
    parsed = normalise_identifier(body.identifier)
    account_key = f"email:{parsed[1]}" if parsed else f"email:{body.identifier.strip().lower()}"
    client_ip = request.client.host if request.client else "unknown"
    keys = (account_key, f"ip:{client_ip}")
    rate_limit.check(*keys)
    user = find_user(db, body.identifier)
    # verify_password always runs bcrypt, so unknown accounts are not faster to reject than wrong passwords.
    if not verify_password(body.password, user.password_hash if user else None) or user is None:
        rate_limit.record_failure(*keys)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "The email, phone number or password is incorrect.")
    rate_limit.reset(account_key)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated. Contact ReproCare support.")
    if demo_accounts_blocked(user.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Demonstration accounts are disabled on this server.")
    return {"token": create_session(db, user), "user": user_to_dict(user)}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str = Depends(get_session_token), db: Session = Depends(get_db)):
    end_session(db, token)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_to_dict(user)


@router.patch("/me")
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # phone must not belong to another account
    if body.phone and db.scalar(select(User.id).where(User.phone == body.phone, User.id != user.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This phone number is already used by another account.")
    user.full_name = body.full_name.strip()
    user.phone = body.phone
    db.commit()
    return user_to_dict(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange,
    user: User = Depends(get_current_user),
    token: str = Depends(get_session_token),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    if body.current_password == body.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a new password that is different from the current one.")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    # A changed password should lock out anyone else who had a session; this device stays signed in.
    end_other_sessions(db, user, keep_token=token)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sign out on every device, including this one."""
    end_other_sessions(db, user)


RESET_SENT = (
    "If an account matches what you entered, we have sent a link to choose a new password to the email address on that "
    "account. The link works once and expires in {minutes} minutes."
)
RESET_TOO_MANY = "Too many reset requests. Please wait an hour and try again, or contact us."


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(body: ForgotPasswordRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    """emails a reset link. same reply whether the account exists or not"""
    parsed = normalise_identifier(body.identifier)
    client_ip = request.client.host if request.client else "unknown"
    # max 5 per hour per email/phone and 20 per hour per computer
    rate_limit.consume(f"reset:{parsed[1] if parsed else body.identifier.strip().lower()}", 5, 60 * 60, RESET_TOO_MANY)
    rate_limit.consume(f"reset-ip:{client_ip}", 20, 60 * 60, RESET_TOO_MANY)
    user = find_user(db, body.identifier)
    if user is not None and user.is_active and not demo_accounts_blocked(user.email):
        token = create_reset_token(db, user)
        # send the email after replying
        background.add_task(mailer_service.send_password_reset, user.email, user.full_name.split()[0], reset_link(token), settings.password_reset_minutes)
    return {"message": RESET_SENT.format(minutes=settings.password_reset_minutes)}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """set a new password using the token from the reset link"""
    if use_reset_token(db, body.token, body.new_password) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid, has already been used or has expired. Request a new one.")


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(body: DeleteAccountRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """delete your own account after confirming your password. admins can't delete themselves"""
    if user.role == "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator accounts cannot be deleted here. Ask another administrator to remove the account.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your password is incorrect. Your account has not been deleted.")
    delete_account(db, user)