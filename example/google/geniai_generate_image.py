import os

from google import genai
from google.genai import types

from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview", contents=["生成关于一只龙虾外接了一个 google 图标的知识库的文章封面"]
    # ,
    # config=types.GenerateContentConfig(temperature=1.0,
    #                                    image_config=types.ImageConfig(aspect_ratio="16:9", image_size="1K"))
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
