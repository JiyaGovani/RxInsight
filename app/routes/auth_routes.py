
from datetime import datetime
from urllib.parse import urlparse

from flask import Blueprint, jsonify, request, session, render_template, redirect

from app.dao.user_dao import UserDAO
from app.models.user import User


# Keep routes in this file as requested.
bp = Blueprint("auth", __name__)


_users_table_checked = False


def _is_safe_next_url(next_url):
    if not next_url:
        return False

    parsed = urlparse(next_url)
    return parsed.scheme == "" and parsed.netloc == "" and next_url.startswith("/")


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
    """Serve login page and preserve redirect target via `next`."""
    if session.get("user_id"):
        if session.get("role") == 1:
            return redirect("/admin")
        return redirect("/dashboard")

    next_url = (request.args.get("next") or "").strip()
    if not _is_safe_next_url(next_url):
        next_url = ""

    return render_template("login.html", next_url=next_url)


@bp.route("/logout")
def logout():
    session.clear()
    return redirect("/")


@bp.route("/auth/login", methods=["POST"])
def login():
    """Minimal login endpoint (JSON responses only)."""
    data = _get_payload()

    identifier = str(data.get("identifier", "")).strip()
    password = str(data.get("password", ""))
    next_url = str(data.get("next", "")).strip()
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

        default_redirect = "/admin" if getattr(user, "role", 0) == 1 else "/dashboard"
        redirect_url = next_url if _is_safe_next_url(next_url) else default_redirect
        return jsonify(success=True, message="Login successful", redirect=redirect_url), 200
    except Exception:
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Login failed"), 500


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


@bp.route("/auth/signup", methods=["POST"])
def register():
    """Register a new user (JSON responses)."""
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
    email = str(data["email"]).strip()
    password = str(data["password"])
    contact_number = str(data["contact_number"]).strip()
    emergency_contact = str(data["emergency_contact"]).strip()

    # Keep parsing simple but safe (PostgreSQL DATE/NUMERIC expect valid values).
    try:
        date_of_birth = datetime.strptime(str(data["date_of_birth"]).strip(), "%Y-%m-%d").date()
    except ValueError:
        return jsonify(success=False, message="Invalid date_of_birth (use YYYY-MM-DD)"), 400

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

    new_user = User(
        username=username,
        email=email,
        contact_number=contact_number,
        emergency_contact=emergency_contact,
        date_of_birth=date_of_birth,
        weight=weight,
        height=height,
        role=0,
    )

    try:
        user_id = user_dao.create_user(new_user, password)
        if not user_id:
            return jsonify(success=False, message="Registration failed"), 500

        return jsonify(success=True, message="Registration successful", user_id=user_id), 201
    except Exception:
        # DAO already rolls back; do a best-effort rollback too.
        try:
            user_dao.conn.rollback()
        except Exception:
            pass
        return jsonify(success=False, message="Registration failed"), 500
