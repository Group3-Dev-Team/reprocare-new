"""Request bodies for registration, sign-in and profile changes."""

from pydantic import AliasChoices, BaseModel, EmailStr, Field, field_validator

from app.schemas.phone import AccountPhone


def _password_rules(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password is too long. Use 72 characters or fewer.")
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not any(c.isdigit() for c in value) or not any(c.isalpha() for c in value):
        raise ValueError("Password must contain letters and at least one number.")
    return value


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(max_length=128)
    # kenyan number or empty
    phone: AccountPhone = Field(default=None, max_length=40)

    _check_password = field_validator("password")(_password_rules)


class LoginRequest(BaseModel):
    # email or phone. old website still sends it as "email"
    identifier: str = Field(min_length=3, max_length=255, validation_alias=AliasChoices("identifier", "email"))
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: AccountPhone = Field(default=None, max_length=40)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(max_length=128)

    _check_password = field_validator("new_password")(_password_rules)


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255, description="The email address or phone number on the account")


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(max_length=128)

    _check_password = field_validator("new_password")(_password_rules)


class DeleteAccountRequest(BaseModel):
    # password to confirm
    password: str = Field(min_length=1, max_length=128)