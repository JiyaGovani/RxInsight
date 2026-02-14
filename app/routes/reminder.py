from flask import Blueprint, jsonify, request, session

from app.dao.reminder_dao import ReminderDAO
from app.db.connection import get_connection
from app.utils.decorators import login_required


bp = Blueprint("reminder", __name__)


def _serialize_reminder(reminder):
	def _to_iso(value):
		return value.isoformat() if hasattr(value, "isoformat") else value

	return {
		"reminder_id": reminder.get("reminder_id"),
		"user_id": reminder.get("user_id"),
		"medicine_name": reminder.get("medicine_name"),
		"number_of_days": reminder.get("number_of_days"),
		"frequency": reminder.get("frequency") or [],
		"time_setters": [str(t) for t in (reminder.get("time_setters") or [])],
		"missed_dose_reminder": reminder.get("missed_dose_reminder"),
		"status": reminder.get("status"),
		"start_date": _to_iso(reminder.get("start_date")),
		"end_date": _to_iso(reminder.get("end_date")),
		"msg_sent": reminder.get("msg_sent"),
		"created_at": _to_iso(reminder.get("created_at")),
	}


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

		return jsonify({"success": True, "reminder_id": reminder_id}), 201
	except Exception as e:
		if conn:
			conn.rollback()
		print(f"Reminder save error: {e}")
		return jsonify({"success": False, "error": "Failed to save reminder"}), 500


@bp.route("/reminders", methods=["GET"])
@login_required
def get_user_reminders():
	conn = None
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

		updated_id = reminder_dao.update_reminder_status_for_user(reminder_id, user_id, status)
		if not updated_id:
			return jsonify({"success": False, "error": "Reminder not found"}), 404

		conn.commit()
		return jsonify({"success": True, "reminder_id": updated_id, "status": status}), 200
	except Exception as e:
		if conn:
			conn.rollback()
		print(f"Reminder status update error: {e}")
		return jsonify({"success": False, "error": "Failed to update reminder status"}), 500
