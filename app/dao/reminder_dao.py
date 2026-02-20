from datetime import date
import logging


class ReminderDAO:
    def __init__(self, connection):
        self.conn = connection
        self.logger = logging.getLogger(__name__)

    def insert_reminder(self, user_id, data):
        query = """
            INSERT INTO reminders (
                user_id,
                medicine_name,
                number_of_days,
                frequency,
                time_setters,
                missed_dose_reminder,
                status,
                start_date,
                msg_sent
            ) VALUES (%s, %s, %s, %s, %s::time[], %s, %s, %s, %s)
            RETURNING reminder_id;
        """

        frequency = data.get("frequency") or []
        time_setters = data.get("time_setters") or []

        with self.conn.cursor() as cur:
            cur.execute(
                query,
                (
                    user_id,
                    data.get("medicine_name"),
                    data.get("number_of_days"),
                    frequency,
                    time_setters,
                    bool(data.get("missed_dose_reminder", False)),
                    data.get("status", "pending"),
                    data.get("start_date", date.today()),
                    bool(data.get("msg_sent", False)),
                ),
            )
            reminder_id = cur.fetchone()[0]
            return reminder_id

    def get_reminders_by_user(self, user_id):
        query = """
            SELECT
                reminder_id, user_id, medicine_name, number_of_days,
                frequency, time_setters, missed_dose_reminder, status,
                start_date, end_date, msg_sent, created_at
            FROM reminders
            WHERE user_id = %s
            ORDER BY created_at DESC;
        """

        try:
            with self.conn.cursor() as cur:
                cur.execute(query, (user_id,))
                rows = cur.fetchall()

            return [{
                "reminder_id": row[0],
                "user_id": row[1],
                "medicine_name": row[2],
                "number_of_days": row[3],
                "frequency": row[4],
                "time_setters": row[5],
                "missed_dose_reminder": row[6],
                "status": row[7],
                "start_date": row[8],
                "end_date": row[9],
                "msg_sent": row[10],
                "created_at": row[11],
            } for row in rows]
        except Exception as e:
            print(f"Database error in get_reminders_by_user: {e}")
            raise

    def update_reminder_status(self, reminder_id, status):
        query = """
            UPDATE reminders
            SET status = %s
            WHERE reminder_id = %s
            RETURNING reminder_id;
        """

        with self.conn.cursor() as cur:
            cur.execute(query, (status, reminder_id))
            row = cur.fetchone()
            return row[0] if row else None

    def update_reminder_status_for_user(self, reminder_id, user_id, status):
        query = """
            UPDATE reminders
            SET status = %s
            WHERE reminder_id = %s AND user_id = %s
            RETURNING reminder_id;
        """

        with self.conn.cursor() as cur:
            cur.execute(query, (status, reminder_id, user_id))
            row = cur.fetchone()
            return row[0] if row else None

    def get_reminder_by_id_for_user(self, reminder_id, user_id):
        query = """
            SELECT
                reminder_id,
                user_id,
                medicine_name,
                number_of_days,
                frequency,
                time_setters,
                missed_dose_reminder,
                status,
                start_date,
                end_date,
                msg_sent,
                created_at
            FROM reminders
            WHERE reminder_id = %s AND user_id = %s;
        """

        with self.conn.cursor() as cur:
            cur.execute(query, (reminder_id, user_id))
            row = cur.fetchone()

        if not row:
            return None

        return {
            "reminder_id": row[0],
            "user_id": row[1],
            "medicine_name": row[2],
            "number_of_days": row[3],
            "frequency": row[4],
            "time_setters": row[5],
            "missed_dose_reminder": row[6],
            "status": row[7],
            "start_date": row[8],
            "end_date": row[9],
            "msg_sent": row[10],
            "created_at": row[11],
        }

    def mark_message_sent(self, reminder_id):
        query = """
            UPDATE reminders
            SET msg_sent = TRUE
            WHERE reminder_id = %s
            RETURNING reminder_id;
        """

        with self.conn.cursor() as cur:
            cur.execute(query, (reminder_id,))
            row = cur.fetchone()
            return row[0] if row else None

    def log_dose(self, reminder_id, user_id, dose_date, dose_time, status):
        """Log a dose taken, missed, or pending."""
        query = """
            INSERT INTO dose_logs (reminder_id, user_id, dose_date, dose_time, status)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (reminder_id, dose_date, dose_time)
            DO UPDATE SET status = EXCLUDED.status, logged_at = NOW()
            RETURNING log_id;
        """
        
        with self.conn.cursor() as cur:
            cur.execute(query, (reminder_id, user_id, dose_date, dose_time, status))
            row = cur.fetchone()
            return row[0] if row else None

    def get_dose_logs_for_reminder(self, reminder_id, user_id):
        """Get all dose logs for a specific reminder."""
        query = """
            SELECT log_id, reminder_id, user_id, dose_date, dose_time, status, logged_at
            FROM dose_logs
            WHERE reminder_id = %s AND user_id = %s
            ORDER BY dose_date DESC, dose_time DESC;
        """
        
        with self.conn.cursor() as cur:
            cur.execute(query, (reminder_id, user_id))
            rows = cur.fetchall()
        
        return [{
            "log_id": row[0],
            "reminder_id": row[1],
            "user_id": row[2],
            "dose_date": row[3],
            "dose_time": row[4],
            "status": row[5],
            "logged_at": row[6],
        } for row in rows]

    def get_todays_doses_for_user(self, user_id, dose_date=None):
        """Get all doses for a user for a specific date (default today)."""
        if dose_date is None:
            dose_date = date.today()
        
        query = """
            SELECT 
                dl.log_id, dl.reminder_id, dl.dose_date, dl.dose_time, dl.status,
                r.medicine_name, r.missed_dose_reminder
            FROM dose_logs dl
            JOIN reminders r ON r.reminder_id = dl.reminder_id
            WHERE dl.user_id = %s AND dl.dose_date = %s
            ORDER BY dl.dose_time ASC;
        """
        
        with self.conn.cursor() as cur:
            cur.execute(query, (user_id, dose_date))
            rows = cur.fetchall()
        
        return [{
            "log_id": row[0],
            "reminder_id": row[1],
            "dose_date": row[2],
            "dose_time": row[3],
            "status": row[4],
            "medicine_name": row[5],
            "missed_dose_reminder": row[6],
        } for row in rows]
