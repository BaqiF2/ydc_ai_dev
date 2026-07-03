# Google Gemini API Example
import os

from google import genai
from google.genai import types
from google.genai.types import ThinkingLevel
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

response = client.models.generate_content(
    model="gemini-3-flash-preview", contents="Explain how AI works in a few words",
    config=types.GenerateContentConfig(max_output_tokens=4096, temperature=0.7,
                                       thinking_config=types.ThinkingConfig(thinking_level=ThinkingLevel.LOW))
)
print(response.text)
