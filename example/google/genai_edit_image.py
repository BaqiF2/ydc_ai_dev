from google import genai
from google.genai import types
from PIL import Image

import os

from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

prompt = (
    "生成一张马年我一路顺风的图片",
    "把背景换成雪山",
)

image = Image.open("./generated_image.png")

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview", contents=[prompt, image]
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("edit_image.png")
