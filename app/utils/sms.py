import os

from twilio.base.exceptions import TwilioException
from twilio.rest import Client


MISSED_DOSE_TEMPLATE = "RxInsight Alert: {username} has missed a recent dose. Please check in."


def _get_twilio_env():
    return {
        "account_sid": os.getenv("TWILIO_ACCOUNT_SID", "").strip(),
        "auth_token": os.getenv("TWILIO_AUTH_TOKEN", "").strip(),
        "from_number": os.getenv("TWILIO_FROM_NUMBER", "").strip(),
    }


def is_sms_configured():
    cfg = _get_twilio_env()
    return bool(cfg["account_sid"] and cfg["auth_token"] and cfg["from_number"])


def send_sms(to_number, body):
    cfg = _get_twilio_env()

    if not is_sms_configured():
        return {"success": False, "error": "Twilio is not configured"}

    to_number = (to_number or "").strip()
    if not to_number:
        return {"success": False, "error": "Recipient phone number is missing"}

    message_body = str(body or "").strip()
    if not message_body:
        return {"success": False, "error": "Message body is empty"}

    try:
        client = Client(cfg["account_sid"], cfg["auth_token"])
        message = client.messages.create(
            body=message_body,
            from_=cfg["from_number"],
            to=to_number,
        )
        return {"success": True, "sid": message.sid}
    except TwilioException as exc:
        return {"success": False, "error": str(exc)}


def build_missed_dose_message(username):
    safe_username = (username or "User").strip() or "User"
    return MISSED_DOSE_TEMPLATE.format(username=safe_username)
