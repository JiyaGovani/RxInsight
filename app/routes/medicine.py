from flask import Blueprint, jsonify, request, session

from app.dao.medicine_dao import MedicineDAO
from app.db.connection import get_connection
from app.utils.decorators import login_required


bp = Blueprint("medicine", __name__)


@bp.route("/admin/medicines", methods=["GET"])
@login_required
def get_all_medicines():
	if session.get("role") != 1:
		return jsonify({"success": False, "error": "Admin access required"}), 403

	conn = None
	try:
		conn = get_connection()
		medicine_dao = MedicineDAO(conn)
		medicines = medicine_dao.get_all_medicines()
		return jsonify({"success": True, "medicines": medicines}), 200
	except Exception as e:
		print(f"Medicine fetch error: {e}")
		return jsonify({"success": False, "error": "Failed to fetch medicines"}), 500


@bp.route("/admin/medicines", methods=["POST"])
@login_required
def add_medicine():
	if session.get("role") != 1:
		return jsonify({"success": False, "error": "Admin access required"}), 403

	data = request.get_json(silent=True) or {}
	required_fields = [
		"name",
		"url",
		"composition",
		"dose_form",
		"uses",
		"side_effect",
		"drug_interactions",
	]

	missing_fields = [field for field in required_fields if not str(data.get(field, "")).strip()]
	if missing_fields:
		return jsonify(
			{
				"success": False,
				"error": "All medicine fields are mandatory",
				"missing_fields": missing_fields,
			}
		), 400

	conn = None
	try:
		conn = get_connection()
		medicine_dao = MedicineDAO(conn)

		medicine_payload = {field: str(data.get(field)).strip() for field in required_fields}
		medicine_id = medicine_dao.insert_medicine(medicine_payload)

		conn.commit()
		return jsonify({"success": True, "medicine_id": medicine_id}), 201
	except Exception as e:
		if conn:
			conn.rollback()
		print(f"Medicine save error: {e}")
		return jsonify({"success": False, "error": "Failed to save medicine"}), 500


@bp.route("/admin/medicines", methods=["DELETE"])
@login_required
def delete_medicine_by_name():
	if session.get("role") != 1:
		return jsonify({"success": False, "error": "Admin access required"}), 403

	data = request.get_json(silent=True) or {}
	medicine_name = str(data.get("name", "")).strip()

	if not medicine_name:
		return jsonify({"success": False, "error": "Medicine name is required"}), 400

	conn = None
	try:
		conn = get_connection()
		medicine_dao = MedicineDAO(conn)
		deleted_count = medicine_dao.delete_medicines_by_name(medicine_name)

		if deleted_count == 0:
			return jsonify({"success": False, "error": f"No medicine found with name '{medicine_name}'"}), 404

		conn.commit()
		return jsonify({"success": True, "deleted_count": deleted_count, "name": medicine_name}), 200
	except Exception as e:
		if conn:
			conn.rollback()
		print(f"Medicine delete error: {e}")
		return jsonify({"success": False, "error": "Failed to delete medicine"}), 500
