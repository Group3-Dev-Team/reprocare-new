"""Sends emails (plain text). If no email server is set, the email is printed in the terminal."""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("reprocare.mail")


def send_email(to: str, subject: str, body: str) -> bool:
    """send an email, returns True if it was sent"""
    if not settings.smtp_host:
        if settings.is_production:
            logger.error("SMTP is not configured; an email to %s (%s) was not sent.", to, subject)
        else:
            # no email server on our laptops, so print it instead
            print(f"\n--- Email (not sent: SMTP_HOST is empty) ---\nTo: {to}\nSubject: {subject}\n\n{body}\n---\n", flush=True)
        return False

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        if settings.smtp_starttls:
            # port 587
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
        else:
            # port 465
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15, context=ssl.create_default_context()) as server:
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not send email to %s (%s).", to, subject)
        return False
    return True


def send_password_reset(to: str, name: str, link: str, minutes: int) -> bool:
    body = (
        f"Hello {name},\n\n"
        "Someone asked to reset the password for your ReproCare account. To choose a new password, open this link:\n\n"
        f"{link}\n\n"
        f"The link works once and expires in {minutes} minutes. Choosing a new password signs you out on every device.\n\n"
        "If you did not ask for this, you can ignore this email: your password has not changed.\n\n"
        "ReproCare"
    )
    return send_email(to, "Reset your ReproCare password", body)