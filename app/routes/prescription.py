import os
import tempfile
from flask import Blueprint, jsonify, request, session
from app.dao.medicine_dao import MedicineDAO
from app.db.connection import get_connection
from app.utils.decorators import login_required
from app.utils.text_extractor import TextExtractor
from app.utils.prescription_parser import PrescriptionParser

bp = Blueprint("prescription", __name__)


@bp.route("/admin/prescriptions", methods=["GET"])
@login_required
def get_admin_prescriptions():
    """Fetch all prescriptions across users grouped by prescription_id for admin dashboard."""
    if session.get("role") != 1:
        return jsonify({"success": False, "error": "Admin access required"}), 403

    username = str(request.args.get("username", "")).strip()
    limit_value = request.args.get("limit", type=int)
    limit = limit_value if limit_value and limit_value > 0 else None

    conn = None
    try:
        conn = get_connection()

        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.prescriptions')")
            prescriptions_table_exists = cur.fetchone()[0] is not None

            if not prescriptions_table_exists:
                return jsonify({"success": True, "prescriptions": []}), 200

            if username:
                cur.execute(
                    """
                    SELECT
                        p.prescription_id,
                        p.user_id,
                        u.username,
                        p.medicine_name,
                        p.dosage,
                        p.frequency,
                        p.duration,
                        p.created_at
                    FROM prescriptions p
                    LEFT JOIN users u ON u.user_id = p.user_id
                    WHERE LOWER(u.username) = LOWER(%s)
                    ORDER BY p.created_at DESC, p.prescription_id DESC
                    """,
                    (username,)
                )
            else:
                cur.execute(
                    """
                    SELECT
                        p.prescription_id,
                        p.user_id,
                        u.username,
                        p.medicine_name,
                        p.dosage,
                        p.frequency,
                        p.duration,
                        p.created_at
                    FROM prescriptions p
                    LEFT JOIN users u ON u.user_id = p.user_id
                    ORDER BY p.created_at DESC, p.prescription_id DESC
                    """
                )
            rows = cur.fetchall()

        prescriptions = {}
        for row in rows:
            prescription_id = row[0]
            user_id = row[1]
            username = row[2]
            grouping_key = (prescription_id, user_id)

            if grouping_key not in prescriptions:
                prescriptions[grouping_key] = {
                    "prescription_id": prescription_id,
                    "user_id": user_id,
                    "username": username,
                    "upload_date": row[7].isoformat() if hasattr(row[7], "isoformat") else str(row[7]),
                    "medicines": [],
                }

            prescriptions[grouping_key]["medicines"].append(
                {
                    "medicine_name": row[3],
                    "dosage": row[4],
                    "frequency": row[5],
                    "duration": row[6],
                }
            )

        prescription_list = list(prescriptions.values())
        if limit is not None:
            prescription_list = prescription_list[:limit]
        return jsonify({"success": True, "prescriptions": prescription_list}), 200

    except Exception as e:
        print(f"Error fetching admin prescriptions: {e}")
        return jsonify({"success": False, "error": "Failed to fetch prescriptions"}), 500
    finally:
        if conn:
            conn.close()

@bp.route("/upload-prescription", methods=["POST"])
@login_required
def upload_prescription():
    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided"}), 400

    image_file = request.files["image"]
    if not image_file or not image_file.filename:
        return jsonify({"success": False, "error": "Invalid image file"}), 400

    temp_path = None
    try:
        # Save the uploaded file to a temporary path
        suffix = os.path.splitext(image_file.filename)[1] or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            image_file.save(tmp)
            temp_path = tmp.name

        # 1. Extract text from the image
        extractor = TextExtractor()
        text_extraction_result, status_code = extractor.extract_text_from_image(temp_path)
        
        if status_code != 200:
            return jsonify({"success": False, "error": text_extraction_result.get("error", "Text extraction failed")}), status_code
            
        raw_text = text_extraction_result.get("text")

        # 2. Parse the extracted text
        parser = PrescriptionParser(raw_text)
        result, status_code = parser.extract_all_medicines()

        print("--- Parsed Data ---")
        import pprint
        pprint.pprint(result)
        print("---------------------")

        if status_code != 200:
            return jsonify({"success": False, "error": result.get("error") or result.get("message", "Parsing failed")}), status_code

        medicines = result.get("medicines", [])
        if not medicines:
            return jsonify({"success": False, "error": "No medicines found in the prescription"}), 400

        # 3. Build rows for all medicines found in this prescription
        medicine_rows = []
        for item in medicines:
            medicine_name = item.get("medicine")
            if not medicine_name:
                continue

            medicine_rows.append(
                {
                    "medicine_name": medicine_name,
                    "dosage": ", ".join(item.get("dosage", [])),
                    "frequency": ", ".join(item.get("frequency", [])),
                    "duration": item.get("duration"),
                }
            )

        if not medicine_rows:
            return jsonify({"success": False, "error": "No valid medicines found in the prescription"}), 400

        print("--- Medicine Rows ---")
        print(medicine_rows)
        print("---------------------")

        try:
            conn = get_connection()
            medicine_dao = MedicineDAO(conn)
            user_id = session.get("user_id")
            prescription_id = medicine_dao.get_next_prescription_id()

            medicine_names = [row.get("medicine_name", "") for row in medicine_rows]
            details_map = medicine_dao.get_medicine_details_by_names(medicine_names)

            enriched_medicines = []
            for row in medicine_rows:
                key = (row.get("medicine_name") or "").strip().lower()
                details = details_map.get(key, {})
                enriched_medicines.append(
                    {
                        "name": row.get("medicine_name"),
                        "dose_form": details.get("dose_form"),
                        "composition": details.get("composition"),
                        "uses": details.get("uses"),
                        "side_effect": details.get("side_effect"),
                        "drug_interactions": details.get("drug_interactions"),
                        "url": details.get("url"),
                    }
                )

            for row in medicine_rows:
                medicine_dao.insert_prescription(prescription_id, row, user_id)

            conn.commit()

            if medicine_rows:
                return jsonify(
                    {
                        "success": True,
                        "prescription_id": prescription_id,
                        "inserted_count": len(medicine_rows),
                        "medicines": enriched_medicines,
                    }
                ), 201
            else:
                return jsonify({"success": False, "error": "Failed to save prescription"}), 500
        except Exception as e:
            # Log the exception e
            print(f"Database error: {e}")
            if 'conn' in locals() and conn:
                conn.rollback()
            return jsonify({"success": False, "error": "An internal error occurred"}), 500
        finally:
            if 'conn' in locals() and conn:
                conn.close()
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        # Log the exception e
        return jsonify({"success": False, "error": "An unexpected error occurred."}), 500
    finally:
        # Clean up the temporary file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@bp.route("/prescriptions/history", methods=["GET"])
@login_required
def get_prescription_history():
    """Fetch all prescriptions for the logged-in user grouped by prescription_id."""
    conn = None
    try:
        conn = get_connection()
        user_id = session.get("user_id")
        
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    prescription_id,
                    medicine_name,
                    dosage,
                    frequency,
                    duration,
                    created_at
                FROM prescriptions
                WHERE user_id = %s
                ORDER BY created_at DESC, prescription_id DESC
                """,
                (user_id,)
            )
            rows = cur.fetchall()
        
        # Group by prescription_id
        prescriptions = {}
        for row in rows:
            prescription_id = row[0]
            if prescription_id not in prescriptions:
                prescriptions[prescription_id] = {
                    "prescription_id": prescription_id,
                    "upload_date": row[5].isoformat() if hasattr(row[5], "isoformat") else str(row[5]),
                    "medicines": []
                }
            
            prescriptions[prescription_id]["medicines"].append({
                "medicine_name": row[1],
                "dosage": row[2],
                "frequency": row[3],
                "duration": row[4]
            })
        
        # Convert to list
        prescription_list = list(prescriptions.values())
        
        return jsonify({"success": True, "prescriptions": prescription_list}), 200
        
    except Exception as e:
        print(f"Error fetching prescription history: {e}")
        return jsonify({"success": False, "error": "Failed to fetch prescription history"}), 500
    finally:
        if conn:
            conn.close()
