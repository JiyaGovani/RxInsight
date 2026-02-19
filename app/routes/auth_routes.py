
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file, session, redirect

from app.dao.user_dao import UserDAO
from app.models.user import User
from app.utils.decorators import login_required


# Keep routes in this file as requested.
bp = Blueprint("auth", __name__)


_users_table_checked = False


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
                    WHERE role = 0 AND username = %s
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
                cur.execute("SELECT medicine_id FROM medicines ORDER BY medicine_id DESC LIMIT 1")
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
