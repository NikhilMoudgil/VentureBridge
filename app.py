from flask import Flask, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv
import os
from PIL import Image

# Load API key from .env
load_dotenv()
api_key = os.getenv("API_KEY")

if not api_key:
    raise ValueError("API_KEY not found. Make sure it's set in the .env file!")

# Configure Google Gemini API
genai.configure(api_key=api_key)

app = Flask(__name__)

# Function for text-to-text
def text_to_text(prompt):
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text

# Function for image-to-text
def image_to_text(image_path, prompt="Extract text from this image"):
    model = genai.GenerativeModel("gemini-pro-vision")
    image = Image.open(image_path)
    response = model.generate_content([prompt], [image])
    return response.text

# API Endpoint for text-to-text
@app.route("/text-to-text", methods=["POST"])
def handle_text_to_text():
    data = request.json
    prompt = data.get("prompt", "")
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
    result = text_to_text(prompt)
    return jsonify({"response": result})

# API Endpoint for image-to-text
@app.route("/image-to-text", methods=["POST"])
def handle_image_to_text():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400
    image = request.files["image"]
    image_path = f"temp_{image.filename}"
    image.save(image_path)
    result = image_to_text(image_path)
    os.remove(image_path)  # Delete image after processing
    return jsonify({"response": result})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
