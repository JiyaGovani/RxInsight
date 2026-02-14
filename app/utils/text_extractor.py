import pytesseract
import cv2

class TextExtractor:
    """
    Extract text from an image using OpenCV preprocessing and Tesseract OCR.
    """

    def __init__(self):
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    def extract_text_from_image(self, image_path):
        """
        Extract text from an image using OCR.

        """
        try:
            #Validate input
            if not image_path:
                return {"error": "Image path not provided"}, 400

            #Read image
            img_cv = cv2.imread(image_path)
            if img_cv is None:
                return {"error": "Unable to read image file"}, 400

            #Convert to grayscale
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

            #Apply thresholding
            _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)

            #OCR extraction
            text = pytesseract.image_to_string(thresh, config="--psm 3")

            if not text.strip():
                return {"message": "No text detected in image"}, 404

            #Success response
            return {"text": text.strip()}, 200
        except Exception as e:
            # In case of any other error during processing
            return {"error": f"An unexpected error occurred: {str(e)}"}, 500

        except pytesseract.TesseractNotFoundError:
            return {"error": "Tesseract OCR is not installed or not configured"}, 500

        except Exception as e:
            return {"error": "Failed to extract text from image"}, 500
