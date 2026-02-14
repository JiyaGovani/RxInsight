from app.db.connection import get_connection
from app.models.user import User
from werkzeug.security import check_password_hash, generate_password_hash


class UserDAO:
    def __init__(self):
        self.conn = get_connection()
        if self.conn:
            print("db connected")

    def create_user(self, user, password_plain):
        try:
            password_hash = generate_password_hash(password_plain)
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (username, email, password_hash, contact_number, emergency_contact, date_of_birth, weight, height, role)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING user_id
                    """,
                    (
                        user.username,
                        user.email,
                        password_hash,
                        user.contact_number,
                        user.emergency_contact,
                        user.date_of_birth,
                        user.weight,
                        user.height,
                        user.role,
                    ),
                )
                row = cur.fetchone()
                user_id = row[0] if row else None
            self.conn.commit()
            print(user_id)
            return user_id
        except Exception:
            self.conn.rollback()
            raise

    def find_by_username(self, username):
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id, username, email, password_hash, contact_number, emergency_contact, date_of_birth, weight, height, role, created_at FROM users WHERE username = %s",
                    (username,),
                )
                row = cur.fetchone()
            if not row:
                return None
            return User(
                row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]
            )
        except Exception:
            self.conn.rollback()
            raise

    def find_by_email(self, email):
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id, username, email, password_hash, contact_number, emergency_contact, date_of_birth, weight, height, role, created_at FROM users WHERE email = %s",
                    (email,),
                )
                row = cur.fetchone()
            if not row:
                return None
            return User(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10])
        except Exception:
            self.conn.rollback()
            raise

    def find_by_id(self, user_id):
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id, username, email, password_hash, contact_number, emergency_contact, date_of_birth, weight, height, role, created_at FROM users WHERE user_id = %s",
                    (user_id,),
                )
                row = cur.fetchone()
            if not row:
                return None
            return User(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10])
        except Exception:
            self.conn.rollback()
            raise

    def verify_credentials(self, username_or_email, password_plain):
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id, username, email, password_hash, contact_number, emergency_contact, date_of_birth, weight, height, role, created_at FROM users WHERE username = %s OR email = %s",
                    (username_or_email, username_or_email),
                )
                row = cur.fetchone()
            if not row:
                return None
            user = User(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10])
            if not user.password_hash:
                return None
            if check_password_hash(user.password_hash, password_plain):
                return user
            return None
        except Exception:
            self.conn.rollback()
            raise
