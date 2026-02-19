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
            WHERE user_id = %s
            ORDER BY created_at DESC;
        """

        try:
            with self.conn.cursor() as cur:
                cur.execute(query, (user_id,))
                rows = cur.fetchall()

            reminders = []
            for row in rows:
                reminders.append(
                    {
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
                )
            return reminders
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
