import os
import random
import re
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from threading import Lock

from flask import Blueprint, jsonify, request, send_file, session, redirect

from app.dao.user_dao import UserDAO
from app.models.user import User
from app.utils.decorators import login_required


# Keep routes in this file as requested.
bp = Blueprint("auth", __name__)


_users_table_checked = False
_password_reset_otps = {}
_password_reset_otps_lock = Lock()
_signup_otps = {}
_signup_otps_lock = Lock()

OTP_EXPIRY_MINUTES = int(os.getenv("PASSWORD_RESET_OTP_EXPIRY_MINUTES", "10"))
SIGNUP_OTP_EXPIRY_MINUTES = int(os.getenv("SIGNUP_OTP_EXPIRY_MINUTES", "10"))
OTP_LENGTH = 6


def _cleanup_expired_otps(now=None):
    current_time = now or datetime.now(timezone.utc)
    expired_emails = []
    for email, otp_data in _password_reset_otps.items():
        expires_at = otp_data.get("expires_at")
        if expires_at and getattr(expires_at, "tzinfo", None) is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if not expires_at or expires_at <= current_time:
            expired_emails.append(email)

    for email in expired_emails:
        _password_reset_otps.pop(email, None)


def _cleanup_expired_signup_otps(now=None):
    current_time = now or datetime.now(timezone.utc)
    expired_emails = []
    for email, otp_data in _signup_otps.items():
        expires_at = otp_data.get("expires_at")
        if expires_at and getattr(expires_at, "tzinfo", None) is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if not expires_at or expires_at <= current_time:
            expired_emails.append(email)

    for email in expired_emails:
        _signup_otps.pop(email, None)


def _generate_otp():
    lower = 10 ** (OTP_LENGTH - 1)
    upper = (10 ** OTP_LENGTH) - 1
    return str(random.randint(lower, upper))


def _password_policy_error(password):
    if len(password) < 8:
        return "Password length is not sufficient. It must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least 1 uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least 1 lowercase letter"
    if not re.search(r"[0-9]", password):
        return "Password must contain at least 1 digit"
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least 1 special character"
    return None


def _send_otp_email(to_email, subject, body):
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes", "on"}
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip()

    if not smtp_host or not from_email:
        raise RuntimeError("Email service is not configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        if smtp_use_tls:
            server.starttls()
        if smtp_user:
            server.login(smtp_user, smtp_password)
        server.send_message(msg)


def _send_password_reset_otp_email(to_email, otp):
    _send_otp_email(
        to_email=to_email,
        subject="RxInsight Password Reset OTP",
        body=(
            "Your RxInsight password reset OTP is {otp}. "
            "It is valid for {minutes} minutes. "
            "If you did not request this, ignore this email."
        ).format(otp=otp, minutes=OTP_EXPIRY_MINUTES),
    )


def _send_signup_otp_email(to_email, otp):
    _send_otp_email(
        to_email=to_email,
        subject="RxInsight Signup Confirmation OTP",
        body=(
            "Your RxInsight signup confirmation OTP is {otp}. "
            "It is valid for {minutes} minutes. "
            "Enter this OTP to complete your registration."
        ).format(otp=otp, minutes=SIGNUP_OTP_EXPIRY_MINUTES),
    )


def ensure_users_table_exists(conn):
    """Create the users table if it doesn't exist yet.

    This prevents runtime errors like: psycopg.errors.UndefinedTable: relation "users" does not exist
    """
    global _users_table_checked
    if _users_table_checked:
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(150) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                contact_number VARCHAR(50),
                emergency_contact VARCHAR(50),
                date_of_birth DATE,
                weight NUMERIC,
                height NUMERIC,
                role INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            """
        )
    conn.commit()
    _users_table_checked = True


def _get_db_info(conn):
    """Return a few safe details about the connected database."""
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_schema()")
        db_name, schema_name = cur.fetchone()
        cur.execute("SHOW search_path")
        search_path = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
    return {
        "database": db_name,
        "schema": schema_name,
        "search_path": search_path,
        "users_count": user_count,
    }


@bp.route("/login")
@bp.route("/login/")
def login_page():
    """Serve the login/registration page as a plain HTML file."""
    if session.get("user_id"):
        return redirect("/admin" if session.get("role") == 1 else "/dashboard")

    templates_dir = Path(__file__).resolve().parents[1] / "templates"
    return send_file(templates_dir / "login.html", mimetype="text/html")


@bp.route("/logout")
def logout():
    """Clear session and redirect to home page."""
    try:
        session.clear()
    except Exception:
        pass
    return redirect("/")


@bp.route("/auth/login", methods=["POST"])
def login():
    """Minimal login endpoint (JSON responses only)."""
    data = _get_payload()

    identifier = str(data.get("identifier", "")).strip()
    password = str(data.get("password", ""))
    if not identifier or not password:
        return jsonify(success=False, message="Missing identifier or password"), 400

    user_dao = UserDAO()

    # Ensure table exists before querying
    try:
        ensure_users_table_exists(user_dao.conn)
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Database setup error"), 500

    try:
        user = user_dao.verify_credentials(identifier, password)
        if not user:
            return jsonify(success=False, message="Invalid credentials"), 401

        # Persist the logged-in identity for subsequent page renders.
        session.clear()
        session["user_id"] = getattr(user, "user_id", None)
        session["username"] = getattr(user, "username", "")
        session["role"] = getattr(user, "role", 0)

        redirect_url = "/admin" if getattr(user, "role", 0) == 1 else "/dashboard"
        return jsonify(success=True, message="Login successful", redirect=redirect_url), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Login failed"), 500


@bp.route("/auth/forgot-password/request-otp", methods=["POST"])
def request_password_reset_otp():
    data = _get_payload()
    email = str(data.get("email", "")).strip().lower()

    if not email:
        return jsonify(success=False, message="Email is required"), 400

    user_dao = UserDAO()
    try:
        ensure_users_table_exists(user_dao.conn)
        user = user_dao.find_by_email(email)
        if not user:
            return jsonify(success=False, message="No account found for this email"), 404

        otp = _generate_otp()
        _send_password_reset_otp_email(email, otp)

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        with _password_reset_otps_lock:
            _cleanup_expired_otps()
            _password_reset_otps[email] = {
                "otp": otp,
                "expires_at": expires_at,
                "verified": False,
            }

        return jsonify(success=True, message="OTP sent to your email"), 200
    except RuntimeError as e:
        return jsonify(success=False, message=str(e)), 500
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Failed to send OTP"), 500


@bp.route("/auth/forgot-password/verify-otp", methods=["POST"])
def verify_password_reset_otp():
    data = _get_payload()
    email = str(data.get("email", "")).strip().lower()
    otp = str(data.get("otp", "")).strip()

    if not email or not otp:
        return jsonify(success=False, message="Email and OTP are required"), 400

    with _password_reset_otps_lock:
        _cleanup_expired_otps()
        record = _password_reset_otps.get(email)
        if not record:
            return jsonify(success=False, message="OTP not found or expired"), 400

        if str(record.get("otp", "")) != otp:
            _password_reset_otps.pop(email, None)
            return jsonify(success=False, error_code="invalid_otp", message="Invalid OTP. Request a new OTP to continue"), 400

        record["verified"] = True

    return jsonify(success=True, message="OTP verified successfully"), 200


@bp.route("/auth/forgot-password/reset", methods=["POST"])
def reset_password_with_otp():
    data = _get_payload()
    email = str(data.get("email", "")).strip().lower()
    new_password = str(data.get("new_password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not email or not new_password or not confirm_password:
        return jsonify(success=False, message="Email and new password are required"), 400

    if new_password != confirm_password:
        return jsonify(success=False, message="Passwords do not match"), 400

    password_error = _password_policy_error(new_password)
    if password_error:
        return jsonify(success=False, message=password_error), 400

    with _password_reset_otps_lock:
        _cleanup_expired_otps()
        record = _password_reset_otps.get(email)
        if not record:
            return jsonify(success=False, message="OTP not found or expired"), 400
        if not record.get("verified"):
            return jsonify(success=False, message="Please verify OTP first"), 400

    user_dao = UserDAO()
    try:
        ensure_users_table_exists(user_dao.conn)
        user_id = user_dao.update_password_by_email(email, new_password)
        if not user_id:
            return jsonify(success=False, message="No account found for this email"), 404

        with _password_reset_otps_lock:
            _password_reset_otps.pop(email, None)

        return jsonify(success=True, message="Password reset successful"), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Failed to reset password"), 500


@bp.route("/auth/dbinfo", methods=["GET"])
def dbinfo():
    """Quick sanity-check endpoint to confirm which DB/schema the app uses."""
    user_dao = UserDAO()
    try:
        ensure_users_table_exists(user_dao.conn)
        info = _get_db_info(user_dao.conn)
        return jsonify(success=True, **info), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Could not read DB info"), 500


def _get_payload():
    """Accept JSON (fetch) or form data (normal form post)."""
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict() or {}


def _serialize_admin_user(user):
    return {
        "user_id": getattr(user, "user_id", None),
        "username": getattr(user, "username", None),
        "email": getattr(user, "email", None),
        "contact_number": getattr(user, "contact_number", None),
        "emergency_contact": getattr(user, "emergency_contact", None),
        "date_of_birth": getattr(user, "date_of_birth", None).isoformat() if getattr(user, "date_of_birth", None) else None,
        "weight": getattr(user, "weight", None),
        "height": getattr(user, "height", None),
    }


def _serialize_profile_user(user):
    return {
        "user_id": getattr(user, "user_id", None),
        "username": getattr(user, "username", None),
        "email": getattr(user, "email", None),
        "contact_number": getattr(user, "contact_number", None),
        "emergency_contact": getattr(user, "emergency_contact", None),
        "date_of_birth": getattr(user, "date_of_birth", None).isoformat() if getattr(user, "date_of_birth", None) else None,
        "weight": float(getattr(user, "weight", 0)) if getattr(user, "weight", None) is not None else None,
        "height": float(getattr(user, "height", 0)) if getattr(user, "height", None) is not None else None,
        "role": getattr(user, "role", 0),
    }


@bp.route("/auth/profile", methods=["GET"])
@login_required
def get_profile():
    user_id = session.get("user_id")
    user_dao = UserDAO()

    try:
        ensure_users_table_exists(user_dao.conn)
        user = user_dao.find_by_id(user_id)
        if not user:
            return jsonify(success=False, message="User not found"), 404

        return jsonify(success=True, user=_serialize_profile_user(user)), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Failed to load profile"), 500


@bp.route("/auth/profile", methods=["PUT"])
@login_required
def update_profile():
    user_id = session.get("user_id")
    data = _get_payload()
    user_dao = UserDAO()

    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip()
    contact_number = str(data.get("contact_number", "")).strip()
    emergency_contact = str(data.get("emergency_contact", "")).strip()

    if not username or not email:
        return jsonify(success=False, message="Username and email are required"), 400

    try:
        date_of_birth = datetime.strptime(str(data.get("date_of_birth", "")).strip(), "%Y-%m-%d").date()
    except ValueError:
        return jsonify(success=False, message="Invalid date_of_birth (use YYYY-MM-DD)"), 400

    try:
        weight = float(str(data.get("weight", "")).strip())
        height = float(str(data.get("height", "")).strip())
    except ValueError:
        return jsonify(success=False, message="Invalid weight/height"), 400

    try:
        ensure_users_table_exists(user_dao.conn)

        with user_dao.conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id
                FROM users
                WHERE (username = %s OR email = %s) AND user_id <> %s
                LIMIT 1
                """,
                (username, email, user_id),
            )
            conflict = cur.fetchone()

            if conflict:
                return jsonify(success=False, message="Username or email already in use"), 409

            cur.execute(
                """
                UPDATE users
                SET
                    username = %s,
                    email = %s,
                    contact_number = %s,
                    emergency_contact = %s,
                    date_of_birth = %s,
                    weight = %s,
                    height = %s
                WHERE user_id = %s
                """,
                (
                    username,
                    email,
                    contact_number,
                    emergency_contact,
                    date_of_birth,
                    weight,
                    height,
                    user_id,
                ),
            )

        user_dao.conn.commit()

        updated_user = user_dao.find_by_id(user_id)
        if not updated_user:
            return jsonify(success=False, message="User not found"), 404

        session["username"] = updated_user.username
        return jsonify(success=True, message="Profile updated", user=_serialize_profile_user(updated_user)), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Failed to update profile"), 500


@bp.route("/admin/users", methods=["GET"])
@login_required
def admin_users():
    if session.get("role") != 1:
        return jsonify(success=False, error="Admin access required"), 403

    username = str(request.args.get("username", "")).strip()
    user_dao = UserDAO()

    try:
        ensure_users_table_exists(user_dao.conn)

        with user_dao.conn.cursor() as cur:
            if username:
                cur.execute(
                    """
                    SELECT user_id, username, email, password_hash, contact_number, emergency_contact, date_of_birth, weight, height, role, created_at
                    FROM users
                    WHERE role = 0 AND LOWER(username) = LOWER(%s)
                    ORDER BY user_id ASC
                    """,
                    (username,),
                )
            else:
                cur.execute(
                    """
                    SELECT user_id, username, email, password_hash, contact_number, emergency_contact, date_of_birth, weight, height, role, created_at
                    FROM users
                    WHERE role = 0
                    ORDER BY user_id ASC
                    """
                )

            rows = cur.fetchall()

        users = [
            _serialize_admin_user(
                User(
                    row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]
                )
            )
            for row in rows
        ]

        return jsonify(success=True, users=users, total=len(users)), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, error="Failed to fetch users"), 500

@bp.route("/admin/overview-stats", methods=["GET"])
@login_required
def admin_overview_stats():
    if session.get("role") != 1:
        return jsonify(success=False, error="Admin access required"), 403

    user_dao = UserDAO()
    try:
        ensure_users_table_exists(user_dao.conn)

        with user_dao.conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 0")
            user_row = cur.fetchone()
            total_users = int(user_row[0]) if user_row and user_row[0] is not None else 0

            cur.execute("SELECT to_regclass('public.prescriptions')")
            prescriptions_table_exists = cur.fetchone()[0] is not None

            total_prescriptions = 0
            if prescriptions_table_exists:
                cur.execute("SELECT prescription_id FROM prescriptions ORDER BY prescription_id DESC LIMIT 1")
                prescription_row = cur.fetchone()
                total_prescriptions = int(prescription_row[0]) if prescription_row and prescription_row[0] is not None else 0

            cur.execute("SELECT to_regclass('public.medicines')")
            medicines_table_exists = cur.fetchone()[0] is not None

            total_medicines = 0
            if medicines_table_exists:
                cur.execute("SELECT COUNT(*) FROM medicines")
                medicine_row = cur.fetchone()
                total_medicines = int(medicine_row[0]) if medicine_row and medicine_row[0] is not None else 0

        return jsonify(
            success=True,
            total_users=total_users,
            total_prescriptions=total_prescriptions,
            total_medicines=total_medicines,
        ), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, error="Failed to fetch overview stats"), 500


@bp.route("/auth/signup", methods=["POST"])
def register():
    """Start registration by sending email OTP (JSON responses)."""
    data = _get_payload()

    required_fields = [
        "username",
        "email",
        "password",
        "contact_number",
        "emergency_contact",
        "date_of_birth",
        "weight",
        "height",
    ]

    missing = [f for f in required_fields if not str(data.get(f, "")).strip()]
    if missing:
        msg = f"Missing fields: {', '.join(missing)}"
        return jsonify(success=False, message=msg), 400

    username = str(data["username"]).strip()
    email = str(data["email"]).strip().lower()
    password = str(data["password"])
    contact_number = str(data["contact_number"]).strip()
    emergency_contact = str(data["emergency_contact"]).strip()

    password_error = _password_policy_error(password)
    if password_error:
        return jsonify(success=False, message=password_error), 400

    # Keep parsing simple but safe (PostgreSQL DATE/NUMERIC expect valid values).
    try:
        date_of_birth = datetime.strptime(str(data["date_of_birth"]).strip(), "%Y-%m-%d").date()
    except ValueError:
        return jsonify(success=False, message="Invalid date_of_birth (use YYYY-MM-DD)"), 400

    if date_of_birth > datetime.now(timezone.utc).date():
        return jsonify(success=False, message="date_of_birth cannot be in the future"), 400

    try:
        weight = float(str(data["weight"]).strip())
        height = float(str(data["height"]).strip())
    except ValueError:
        return jsonify(success=False, message="Invalid weight/height"), 400

    user_dao = UserDAO()

    # Make sure the table exists before any DAO queries.
    try:
        ensure_users_table_exists(user_dao.conn)
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        msg = "Database setup error: users table is missing and could not be created"
        return jsonify(success=False, message=msg), 500

    # Basic validation: check if user already exists
    if user_dao.find_by_username(username) or user_dao.find_by_email(email):
        return jsonify(success=False, message="User already exists"), 409

    try:
        otp = _generate_otp()
        _send_signup_otp_email(email, otp)

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=SIGNUP_OTP_EXPIRY_MINUTES)
        with _signup_otps_lock:
            _cleanup_expired_signup_otps()
            _signup_otps[email] = {
                "otp": otp,
                "expires_at": expires_at,
                "registration_data": {
                    "username": username,
                    "email": email,
                    "password": password,
                    "contact_number": contact_number,
                    "emergency_contact": emergency_contact,
                    "date_of_birth": date_of_birth,
                    "weight": weight,
                    "height": height,
                },
            }

        return jsonify(success=True, message="Confirmation OTP sent to your email"), 200
    except RuntimeError as e:
        return jsonify(success=False, message=str(e)), 500
    except Exception:
        # DAO already rolls back; do a best-effort rollback too.
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Failed to send signup OTP"), 500


@bp.route("/auth/signup/confirm", methods=["POST"])
def confirm_register():
    data = _get_payload()
    email = str(data.get("email", "")).strip().lower()
    otp = str(data.get("otp", "")).strip()

    if not email or not otp:
        return jsonify(success=False, message="Email and OTP are required"), 400

    with _signup_otps_lock:
        _cleanup_expired_signup_otps()
        record = _signup_otps.get(email)
        if not record:
            return jsonify(success=False, message="OTP not found or expired"), 400

        if str(record.get("otp", "")) != otp:
            _signup_otps.pop(email, None)
            return jsonify(success=False, error_code="invalid_otp", message="Invalid OTP. Request a new OTP to continue"), 400

        registration_data = record.get("registration_data") or {}
        _signup_otps.pop(email, None)

    user_dao = UserDAO()
    try:
        ensure_users_table_exists(user_dao.conn)

        username = str(registration_data.get("username", "")).strip()
        email_from_record = str(registration_data.get("email", "")).strip().lower()
        password = str(registration_data.get("password", ""))
        contact_number = str(registration_data.get("contact_number", "")).strip()
        emergency_contact = str(registration_data.get("emergency_contact", "")).strip()
        date_of_birth = registration_data.get("date_of_birth")
        weight = registration_data.get("weight")
        height = registration_data.get("height")

        if not username or not email_from_record or not password:
            return jsonify(success=False, message="Registration session invalid or expired"), 400

        if user_dao.find_by_username(username) or user_dao.find_by_email(email_from_record):
            return jsonify(success=False, message="User already exists"), 409

        new_user = User(
            username=username,
            email=email_from_record,
            contact_number=contact_number,
            emergency_contact=emergency_contact,
            date_of_birth=date_of_birth,
            weight=weight,
            height=height,
            role=0,
        )

        user_id = user_dao.create_user(new_user, password)
        if not user_id:
            return jsonify(success=False, message="Registration failed"), 500

        return jsonify(success=True, message="Registration successful", user_id=user_id), 201
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Registration failed"), 500
