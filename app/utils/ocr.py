import re

import cv2
import pytesseract

# Point pytesseract to the installed Tesseract executable
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def extract_text_from_image(image_path):
	"""Read an image, apply minimal preprocessing, and return OCR text."""
	image = cv2.imread(image_path)
	if image is None:
		raise FileNotFoundError(f"Unable to read image from path: {image_path}")

	gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
	blurred = cv2.GaussianBlur(gray, (5, 5), 0)
	_, thresholded = cv2.threshold(
		blurred,
		0,
		255,
		cv2.THRESH_BINARY + cv2.THRESH_OTSU,
	)

	raw_text = pytesseract.image_to_string(thresholded)
	return raw_text.strip()


def clean_text(raw_text):
	"""Remove extra spaces and hidden characters from OCR text."""
	text = raw_text.replace("\r", "")
	text = re.sub(r"[ \t]+", " ", text)
	text = re.sub(r"\n+", "\n", text)
	return text.strip()


def split_lines(cleaned_text):
	"""Split text into lines based on newline, numbering, or medicine forms."""
	if not cleaned_text:
		return []
	parts = re.split(r"\n|(?=\d+\))|(?=TAB)|(?=CAP)|(?=SYP)|(?=INJ)", cleaned_text)
	return [line.strip() for line in parts if line.strip()]


def is_medicine_line(line):
	"""Return True if a line contains at least two medicine signals."""
	form = r"\b(TAB|CAP|SYP|INJ)\b"
	dosage = r"\b\d+\s?(mg|ml|mcg)\b"
	frequency = r"\b(OD|BD|TDS|HS|Morning|Night|\d+-\d+-\d+)\b"
	duration = r"\b\d+\s?(Days|Weeks)\b"

	score = 0
	if re.search(form, line, re.IGNORECASE):
		score += 1
	if re.search(dosage, line, re.IGNORECASE):
		score += 1
	if re.search(frequency, line, re.IGNORECASE):
		score += 1
	if re.search(duration, line, re.IGNORECASE):
		score += 1

	return score >= 2


def extract_medicine(line):
	"""Extract medicine name, dosage, frequency, and duration from one line."""
	medicine_name = ""
	dosage = ""
	frequency = ""
	duration = ""

	medicine_match = re.search(r"(TAB|CAP|SYP|INJ),?\s*([A-Z][A-Z0-9 ]+)", line)
	if medicine_match:
		medicine_name = medicine_match.group(2).strip()

	dose_match = re.search(r"\b\d+\s?(mg|ml|mcg)\b", line, re.IGNORECASE)
	if dose_match:
		dosage = dose_match.group().strip()

	freq_match = re.search(r"\b(OD|BD|TDS|HS|Morning|Night|\d+-\d+-\d+)\b", line, re.IGNORECASE)
	if freq_match:
		frequency = freq_match.group().strip()

	dur_match = re.search(r"\b\d+\s?(Days|Weeks)\b", line, re.IGNORECASE)
	if dur_match:
		duration = dur_match.group().strip()

	return {
		"medicine_name": medicine_name,
		"dosage": dosage,
		"frequency": frequency,
		"duration": duration,
	}


def parse_prescription(text):
	"""Parse OCR text using simple rules and minimal regex."""
	result = {
		"doctor_name": "",
		"contact_number": "",
		"medicine_name": "",
		"dosage": "",
		"frequency": "",
		"duration": "",
	}

	cleaned_text = clean_text(text)
	print("--- 2. Cleaned Text ---")
	print(cleaned_text)
	print("-----------------------")
 
	lines = split_lines(cleaned_text)
	medicines = []

	for raw_line in lines:
		line = raw_line.strip()
		if not line:
			continue

		lower_line = line.lower()

		if not result["doctor_name"] and ("dr" in lower_line or "doctor" in lower_line):
			if ":" in line:
				result["doctor_name"] = line.split(":", 1)[1].strip()
			else:
				result["doctor_name"] = line.replace("Dr.", "").replace("Dr", "").replace("Doctor", "").strip(" -:")

		if not result["contact_number"] and (
			"contact" in lower_line
			or "phone" in lower_line
			or "mobile" in lower_line
			or "tel" in lower_line
		):
			match = re.search(r"\+?[0-9][0-9\-()\s]{7,}[0-9]", line)
			if match:
				result["contact_number"] = " ".join(match.group(0).split())

		if is_medicine_line(line):
			medicine_data = extract_medicine(line)
			medicines.append(medicine_data)

		if not result["medicine_name"] and (
			"medicine" in lower_line
			or "medication" in lower_line
			or "drug" in lower_line
		):
			if ":" in line:
				result["medicine_name"] = line.split(":", 1)[1].strip()

		if not result["dosage"] and ("dosage" in lower_line or "dose" in lower_line or "strength" in lower_line):
			if ":" in line:
				result["dosage"] = line.split(":", 1)[1].strip()
			else:
				match = re.search(r"\b[0-9]+\s?(mg|ml|mcg|g|units?)\b", line, flags=re.IGNORECASE)
				if match:
					result["dosage"] = match.group(0).strip()

		if not result["frequency"] and (
			"frequency" in lower_line
			or "freq" in lower_line
			or "schedule" in lower_line
			or "once daily" in lower_line
			or "twice daily" in lower_line
			or "thrice daily" in lower_line
			or "od" in lower_line
			or "bd" in lower_line
			or "tds" in lower_line
			or "qid" in lower_line
		):
			if ":" in line:
				result["frequency"] = line.split(":", 1)[1].strip()
			else:
				result["frequency"] = line

		if not result["duration"] and ("duration" in lower_line or "course" in lower_line or "for" in lower_line):
			if ":" in line:
				result["duration"] = line.split(":", 1)[1].strip()
			else:
				match = re.search(r"\b(for\s+)?[0-9]+\s+(day|days|week|weeks|month|months)\b", line, flags=re.IGNORECASE)
				if match:
					result["duration"] = match.group(0).strip()

	if medicines:
		first_med = medicines[0]
		if not result["medicine_name"]:
			result["medicine_name"] = first_med["medicine_name"]
		if not result["dosage"]:
			result["dosage"] = first_med["dosage"]
		if not result["frequency"]:
			result["frequency"] = first_med["frequency"]
		if not result["duration"]:
			result["duration"] = first_med["duration"]

	# Fallback: pick likely medicine and dosage from any line
	if not result["medicine_name"]:
		for raw_line in lines:
			line = raw_line.strip()
			if not line:
				continue
			if re.search(r"\b[0-9]+\s?(mg|ml|mcg|g|units?)\b", line, flags=re.IGNORECASE):
				result["medicine_name"] = line
				break

	if not result["dosage"] and result["medicine_name"]:
		match = re.search(r"\b[0-9]+\s?(mg|ml|mcg|g|units?)\b", result["medicine_name"], flags=re.IGNORECASE)
		if match:
			result["dosage"] = match.group(0).strip()

	return result


def ocr_prescription(image_path):
	"""Run OCR + regex parsing on a prescription image."""
	print(f"--- Starting OCR for {image_path} ---")
	raw_text = extract_text_from_image(image_path)
	print("--- 1. Raw OCR Text ---")
	print(raw_text)
	print("------------------------")
	
	parsed_data = parse_prescription(raw_text)
	
	print("--- 3. Final Parsed Data ---")
	print(parsed_data)
	print("--------------------------")
	
	return parsed_data


if __name__ == "__main__":
	sample_image_path = "prescription.jpg"
	try:
		data = ocr_prescription(sample_image_path)
		print(data)
	except FileNotFoundError as error:
		print(error)
