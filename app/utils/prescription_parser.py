import re

class PrescriptionParser:
    """
    A class to clean OCR text and extract medicines from printed prescriptions.
    """

    def __init__(self, text):
        self.raw_text = text
        self.cleaned_text = None
        self.lines = None
        self.medicines = []

    def clean_text(self):
        """
        Clean OCR mistakes and normalize spacing.
        """
        text = self.raw_text.replace("\r", "")

        # Fix common OCR mistakes
        text = text.replace("TAB,", "TAB.")
        corrections = {
            "Moring": "Morning",
            "Moming": "Morning",
            "Aft": "Afternoon",
            "Light": "Night",
        }

        for wrong, correct in corrections.items():
            text = re.sub(rf"\b{re.escape(wrong)}\b", correct, text, flags=re.IGNORECASE)

        # Normalize spaces
        text = re.sub(r"\s+", " ", text)

        self.cleaned_text = text
        return self.cleaned_text

    def split_lines(self):
        """
        Split text into medicine blocks properly.
        """
        if not self.cleaned_text:
            self.clean_text()

        # Split by numbering like 1) 2) 3)
        blocks = re.split(r"\d+\)\s*", self.cleaned_text)
        self.lines = [b.strip() for b in blocks if b.strip()]
        return self.lines

    def is_medicine_line(self, line):
        """
        Check if line contains medicine form.
        """
        FORM = r"\b(TAB\.?|CAP\.?|SYP\.?|INJ\.?)\b"
        return bool(re.search(FORM, line, re.IGNORECASE))

    def extract_medicines(self, text):
        medicines = []

        # 1️⃣ Split by medicine numbering (1), 2), 3), etc.
        blocks = re.split(r"\n?\s*\d+\)\s*", text)

        for block in blocks:
            block = block.strip()
            if not block:
                continue

            # Only process blocks that contain a medicine form
            if not re.search(r"\b(TAB|CAP|SYP|INJ)\b", block, re.IGNORECASE):
                continue

            medicine_name = None
            dosage = []
            frequency = []
            duration = None

            # --------------------------
            # Extract Medicine Name
            # --------------------------
            med_match = re.search(
                r"\b(?:TAB|CAP|SYP|INJ)[\.,]?\s+([A-Z][A-Z0-9/\- ]*?)(?=\s+\d+\/?\d*\s*(?:Morning|Night|Afternoon|Eve)\b|\s+\d+\s*(?:Days?|Weeks?)\b|$)",
                block,
                re.IGNORECASE
            )
            if med_match:
                medicine_name = re.sub(r"[\s,.-]+$", "", med_match.group(1).strip())

            # --------------------------
            # Extract Dosage + Frequency
            # --------------------------
            dose_matches = re.findall(
                r"(\d+\/?\d*)\s*(Morning|Night|Afternoon|Eve)",
                block,
                re.IGNORECASE
            )

            for dose, freq in dose_matches:
                dosage.append(dose)
                frequency.append(freq)

            # --------------------------
            # Extract Duration
            # --------------------------
            dur_match = re.search(r"(\d+\s*Days?)", block, re.IGNORECASE)
            if dur_match:
                duration = dur_match.group(1)

            medicines.append({
                "medicine": medicine_name,
                "dosage": dosage,
                "frequency": frequency,
                "duration": duration
            })

        return medicines

    def extract_all_medicines(self):
        if not self.cleaned_text:
            self.clean_text()

        self.medicines = []

        try:
            self.medicines = self.extract_medicines(self.cleaned_text)

            if not self.medicines:
                return {"message": "No medicines found"}, 404

            return {"medicines": self.medicines}, 200

        except Exception:
            return {"error": "Failed to extract medicines"}, 500
