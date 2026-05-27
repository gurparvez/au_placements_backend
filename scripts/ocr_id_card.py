#!/usr/bin/env python3
import base64
import io
import json
import sys


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        image_base64 = payload.get("image_base64")

        if not image_base64:
            print(json.dumps({"success": False, "error": "image_base64 is required"}))
            return

        try:
            from PIL import Image
            import pytesseract
        except Exception as exc:
            print(
                json.dumps(
                    {
                        "success": False,
                        "error": (
                            "Python OCR dependencies are missing. Install Pillow, pytesseract, "
                            f"and the Tesseract binary. Details: {exc}"
                        ),
                    }
                )
            )
            return

        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(image)

        print(json.dumps({"success": True, "text": text}))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))


if __name__ == "__main__":
    main()
