import os

from twilio.base.exceptions import TwilioException
from twilio.rest import Client


MISSED_DOSE_TEMPLATE = "RxInsight Alert: {username} has missed a recent dose. Please check in."


def _get_twilio_env():
    # Gets Twilio credentials from environment variables
    # Returns a dictionary with SID, token, and sender number
    return {
        "account_sid": os.getenv("TWILIO_ACCOUNT_SID", "").strip(),  # Twilio Account SID
        "auth_token": os.getenv("TWILIO_AUTH_TOKEN", "").strip(),    # Twilio Auth Token
        "from_number": os.getenv("TWILIO_FROM_NUMBER", "").strip(),  # Twilio sender phone number
    }


def is_sms_configured():
    # Checks if Twilio SMS is properly configured
    cfg = _get_twilio_env()
    # Returns True if all required credentials are present
    return bool(cfg["account_sid"] and cfg["auth_token"] and cfg["from_number"])


def send_sms(to_number, body):
    # Sends an SMS using Twilio
    cfg = _get_twilio_env()

    # Check if Twilio is configured
    if not is_sms_configured():
        return {"success": False, "error": "Twilio is not configured"}

    # Clean and validate recipient number
    to_number = (to_number or "").strip()
    if not to_number:
        return {"success": False, "error": "Recipient phone number is missing"}

    # Clean and validate message body
    message_body = str(body or "").strip()
    if not message_body:
        return {"success": False, "error": "Message body is empty"}

    try:
        # Create Twilio client with credentials
        client = Client(cfg["account_sid"], cfg["auth_token"])
        # Send SMS message
        message = client.messages.create(
            body=message_body,           # Message text
            from_=cfg["from_number"],   # Sender number
            to=to_number,                # Recipient number
        )
        # Return success and message SID
        return {"success": True, "sid": message.sid}
    except TwilioException as exc:
        # Return error if sending fails
        return {"success": False, "error": str(exc)}


def build_missed_dose_message(username):
    # Builds the missed dose alert message for SMS
    # Ensures username is safe for display
    safe_username = (username or "User").strip() or "User"
    # Formats the template with the username
    return MISSED_DOSE_TEMPLATE.format(username=safe_username)
