import os
import tempfile
from flask import Blueprint, jsonify, request, session
from app.dao.medicine_dao import MedicineDAO
from app.db.connection import get_connection
from app.utils.decorators import login_required
from app.utils.text_extractor import TextExtractor
from app.utils.prescription_parser import PrescriptionParser

bp = Blueprint("prescription", __name__)

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
