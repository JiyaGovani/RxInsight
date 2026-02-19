from flask import Blueprint, jsonify, request, session

from app.dao.reminder_dao import ReminderDAO
from app.dao.user_dao import UserDAO
from app.db.connection import get_connection
from app.utils.decorators import login_required
from app.utils.sms import build_missed_dose_message, is_sms_configured, send_sms


bp = Blueprint("reminder", __name__)


def _serialize_reminder(reminder):
	def _to_iso(value):
		if value and hasattr(value, "isoformat"):
			return value.isoformat()
		return value
	
	def _convert_time(t):
		# Convert PostgreSQL time to HH:MM string
		if hasattr(t, "hour") and hasattr(t, "minute"):
			return f"{t.hour:02d}:{t.minute:02d}"
		# Already a string, extract HH:MM
		time_str = str(t)
		if ':' in time_str:
			return time_str[:5]  # Get HH:MM part
		return time_str
	
	time_setters = reminder.get("time_setters") or []
	converted_times = [_convert_time(t) for t in time_setters]

	return {
		"reminder_id": reminder.get("reminder_id"),
		"user_id": reminder.get("user_id"),
		"medicine_name": reminder.get("medicine_name"),
		"number_of_days": reminder.get("number_of_days"),
		"frequency": reminder.get("frequency") or [],
		"time_setters": converted_times,
		"missed_dose_reminder": reminder.get("missed_dose_reminder"),
		"status": reminder.get("status"),
		"start_date": _to_iso(reminder.get("start_date")),
		"end_date": _to_iso(reminder.get("end_date")),
		"msg_sent": reminder.get("msg_sent"),
		"created_at": _to_iso(reminder.get("created_at")),
	}


@bp.route("/admin/reminders", methods=["GET"])
@login_required
def get_admin_reminders():
	if session.get("role") != 1:
		return jsonify({"success": False, "error": "Admin access required"}), 403

	username = str(request.args.get("username", "")).strip()

	conn = None
	try:
		conn = get_connection()

		with conn.cursor() as cur:
			cur.execute("SELECT to_regclass('public.reminders')")
			reminders_table_exists = cur.fetchone()[0] is not None

			if not reminders_table_exists:
				return jsonify({"success": True, "reminders": []}), 200

			if username:
				cur.execute(
					"""
					SELECT
						r.reminder_id,
						r.user_id,
						u.username,
						r.number_of_days,
						r.medicine_name,
						r.status,
						r.created_at
					FROM reminders r
					LEFT JOIN users u ON u.user_id = r.user_id
					WHERE u.username ILIKE %s
					ORDER BY r.created_at DESC, r.reminder_id DESC
					""",
					(f"%{username}%",)
				)
			else:
				cur.execute(
					"""
					SELECT
						r.reminder_id,
						r.user_id,
						u.username,
						r.number_of_days,
						r.medicine_name,
						r.status,
						r.created_at
					FROM reminders r
					LEFT JOIN users u ON u.user_id = r.user_id
					ORDER BY r.created_at DESC, r.reminder_id DESC
					"""
				)

			rows = cur.fetchall()

		reminders = []
		for row in rows:
			reminders.append(
				{
					"reminder_id": row[0],
					"user_id": row[1],
					"username": row[2],
					"number_of_days": row[3],
					"medicine_name": row[4],
					"status": row[5],
					"created_at": row[6].isoformat() if hasattr(row[6], "isoformat") else str(row[6]),
				}
			)

		return jsonify({"success": True, "reminders": reminders}), 200
	except Exception as e:
		print(f"Admin reminder fetch error: {e}")
		return jsonify({"success": False, "error": "Failed to fetch reminders"}), 500
	finally:
		if conn:
			conn.close()


@bp.route("/set-reminder", methods=["POST"])
@login_required
def set_reminder():
	data = request.get_json(silent=True) or {}

	medicine_name = (data.get("medicine_name") or "").strip()
	number_of_days = data.get("number_of_days")
	frequency = data.get("frequency") or []
	time_setters = data.get("time_setters") or []

	if not medicine_name:
		return jsonify({"success": False, "error": "Medicine name is required"}), 400

	if not isinstance(number_of_days, int) or number_of_days < 1:
		return jsonify({"success": False, "error": "Number of days must be at least 1"}), 400

	if not isinstance(frequency, list) or not frequency:
		return jsonify({"success": False, "error": "At least one frequency is required"}), 400

	if not isinstance(time_setters, list) or len(time_setters) != len(frequency):
		return jsonify({"success": False, "error": "Time setters must match selected frequency"}), 400

	if any((not str(t).strip()) for t in time_setters):
		return jsonify({"success": False, "error": "Time setters cannot be empty"}), 400

	conn = None
	try:
		conn = get_connection()
		reminder_dao = ReminderDAO(conn)
		user_id = session.get("user_id")

		reminder_payload = {
			"medicine_name": medicine_name,
			"number_of_days": number_of_days,
			"frequency": frequency,
			"time_setters": time_setters,
			"missed_dose_reminder": bool(data.get("missed_dose_reminder", False)),
			"status": "pending",
			"msg_sent": False,
		}

		reminder_id = reminder_dao.insert_reminder(user_id, reminder_payload)
		conn.commit()

		sms_result = {"success": False, "error": "SMS not sent"}
		if is_sms_configured():
			try:
				user = UserDAO().find_by_id(user_id)
				contact_number = getattr(user, "contact_number", None) if user else None
				if contact_number:
					message = (
						f"RxInsight: Reminder set for {medicine_name}. "
						f"Time slots: {', '.join(frequency)}. "
						f"Duration: {number_of_days} day(s)."
					)
					sms_result = send_sms(contact_number, message)
				else:
					sms_result = {"success": False, "error": "No contact number found for user"}
			except Exception as sms_error:
				sms_result = {"success": False, "error": str(sms_error)}

		return jsonify({"success": True, "reminder_id": reminder_id, "sms": sms_result}), 201
	except Exception as e:
		if conn:
			conn.rollback()
		print(f"Reminder save error: {e}")
		return jsonify({"success": False, "error": "Failed to save reminder"}), 500


@bp.route("/reminders", methods=["GET"])
@login_required
def get_user_reminders():
	try:
		conn = get_connection()
		reminder_dao = ReminderDAO(conn)
		user_id = session.get("user_id")

		reminders = reminder_dao.get_reminders_by_user(user_id)
		serialized = [_serialize_reminder(item) for item in reminders]

		return jsonify({"success": True, "reminders": serialized}), 200
	except Exception as e:
		print(f"Reminder fetch error: {e}")
		return jsonify({"success": False, "error": "Failed to fetch reminders"}), 500


@bp.route("/reminders/<int:reminder_id>/status", methods=["PATCH"])
@login_required
def update_reminder_status(reminder_id):
	data = request.get_json(silent=True) or {}
	status = (data.get("status") or "").strip().lower()

	if status not in {"taken", "missed", "pending"}:
		return jsonify({"success": False, "error": "Invalid status"}), 400

	conn = None
	try:
		conn = get_connection()
		reminder_dao = ReminderDAO(conn)
		user_id = session.get("user_id")
		reminder = reminder_dao.get_reminder_by_id_for_user(reminder_id, user_id)
		if not reminder:
			return jsonify({"success": False, "error": "Reminder not found"}), 404

		updated_id = reminder_dao.update_reminder_status_for_user(reminder_id, user_id, status)
		if not updated_id:
			return jsonify({"success": False, "error": "Reminder not found"}), 404

		conn.commit()

		sms_result = None
		if status == "missed" and bool(reminder.get("missed_dose_reminder")):
			try:
				user = UserDAO().find_by_id(user_id)
				emergency_contact = getattr(user, "emergency_contact", None) if user else None
				username = session.get("username") or (getattr(user, "username", None) if user else None) or "User"

				if emergency_contact:
					alert_message = build_missed_dose_message(username)
					sms_result = send_sms(emergency_contact, alert_message)
				else:
					sms_result = {"success": False, "error": "Emergency contact number is missing"}
			except Exception as sms_error:
				sms_result = {"success": False, "error": str(sms_error)}

		response = {"success": True, "reminder_id": updated_id, "status": status}
		if sms_result is not None:
			response["sms"] = sms_result

		return jsonify(response), 200
	except Exception as e:
		if conn:
			conn.rollback()
		print(f"Reminder status update error: {e}")
		return jsonify({"success": False, "error": "Failed to update reminder status"}), 500


@bp.route("/reminders/<int:reminder_id>/send-sms", methods=["POST"])
@login_required
def send_reminder_sms(reminder_id):
	if not is_sms_configured():
		return jsonify({"success": False, "error": "Twilio is not configured"}), 400

	conn = None
	try:
		conn = get_connection()
		reminder_dao = ReminderDAO(conn)
		user_id = session.get("user_id")

		reminder = reminder_dao.get_reminder_by_id_for_user(reminder_id, user_id)
		if not reminder:
			return jsonify({"success": False, "error": "Reminder not found"}), 404

		user = UserDAO().find_by_id(user_id)
		contact_number = getattr(user, "contact_number", None) if user else None
		if not contact_number:
			return jsonify({"success": False, "error": "User contact number is missing"}), 400

		times = reminder.get("time_setters") or []
		formatted_times = ", ".join(str(item)[:5] for item in times) if times else "N/A"
		message = (
			f"RxInsight Reminder: Time to take {reminder.get('medicine_name')}. "
			f"Scheduled at {formatted_times}."
		)

		sms_result = send_sms(contact_number, message)
		if not sms_result.get("success"):
			return jsonify({"success": False, "error": sms_result.get("error", "SMS failed")}), 500

		return jsonify({"success": True, "sid": sms_result.get("sid")}), 200
	except Exception as e:
		if conn:
			conn.rollback()
		print(f"Reminder SMS error: {e}")
		return jsonify({"success": False, "error": "Failed to send SMS"}), 500
