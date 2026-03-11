
class MedicineDAO:
    def __init__(self, connection):
        self.conn = connection

    def get_all_medicines(self):
        query = """
            SELECT
                medicine_id,
                name,
                url,
                composition,
                dose_form,
                uses,
                side_effect,
                drug_interactions
            FROM medicines
            ORDER BY medicine_id DESC;
        """

        with self.conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()

        medicines = []
        for row in rows:
            medicines.append(
                {
                    "medicine_id": row[0],
                    "name": row[1],
                    "url": row[2],
                    "composition": row[3],
                    "dose_form": row[4],
                    "uses": row[5],
                    "side_effect": row[6],
                    "drug_interactions": row[7],
                }
            )

        return medicines

    def get_medicine_details_by_names(self, medicine_names):
        if not medicine_names:
            return {}

        query = """
            SELECT name, url, composition, dose_form, uses, side_effect, drug_interactions
            FROM medicines
            WHERE LOWER(name) = ANY(%s);
        """

        normalized_names = [name.strip().lower() for name in medicine_names if name and name.strip()]
        if not normalized_names:
            return {}

        with self.conn.cursor() as cur:
            cur.execute(query, (normalized_names,))
            rows = cur.fetchall()

        details_map = {}
        for row in rows:
            details_map[row[0].strip().lower()] = {
                "name": row[0],
                "url": row[1],
                "composition": row[2],
                "dose_form": row[3],
                "uses": row[4],
                "side_effect": row[5],
                "drug_interactions": row[6],
            }

        return details_map

    def get_next_prescription_id(self):
        query = """
            SELECT COALESCE(MAX(prescription_id), 0) + 1
            FROM prescriptions;
        """
        with self.conn.cursor() as cur:
            cur.execute(query)
            return cur.fetchone()[0]

    def insert_prescription(self, prescription_id, data, user_id):
        query = """
            INSERT INTO prescriptions (
                prescription_id,
                user_id,
                medicine_name,
                dosage,
                frequency,
                duration
            ) VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING prescription_id;
        """
        with self.conn.cursor() as cur:
            cur.execute(
                query,
                (
                    prescription_id,
                    user_id,
                    data.get("medicine_name") or "Unknown",
                    data.get("dosage") or "",
                    data.get("frequency") or "",
                    data.get("duration") or "",
                ),
            )
            prescription_id = cur.fetchone()[0]
            return prescription_id

    def insert_medicine(self, data):
        query = """
            INSERT INTO medicines (
                name,
                url,
                composition,
                dose_form,
                uses,
                side_effect,
                drug_interactions
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING medicine_id;
        """

        with self.conn.cursor() as cur:
            cur.execute(
                query,
                (
                    data.get("name"),
                    data.get("url"),
                    data.get("composition"),
                    data.get("dose_form"),
                    data.get("uses"),
                    data.get("side_effect"),
                    data.get("drug_interactions"),
                ),
            )
            medicine_id = cur.fetchone()[0]
            return medicine_id

    def delete_medicines_by_name(self, medicine_name):
        query = """
            DELETE FROM medicines
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
            RETURNING medicine_id;
        """

        with self.conn.cursor() as cur:
            cur.execute(query, (medicine_name,))
            deleted_rows = cur.fetchall()

        return len(deleted_rows)
