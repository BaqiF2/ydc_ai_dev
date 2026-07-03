"""
使用本地图片作为参考，通过 Google Veo 3.1 生成视频。

核心流程:
- load_dotenv: 加载环境变量配置
- generate_videos: 以本地图片为参考，调用 Veo 3.1 生成视频
- polling: 轮询等待视频生成完成并下载保存
"""

import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

prompt = "一只马跑着拍照插上翅膀飞到了天上"

# Load local image as reference and generate video with Veo 3.1
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt=prompt,
    image=types.Image.from_file(location="./edit_image.png"),
)

# Poll the operation status until the video is ready.
while not operation.done:
    print("Waiting for video generation to complete...")
    time.sleep(10)
    operation = client.operations.get(operation)

# Download the video.
video = operation.response.generated_videos[0]
client.files.download(file=video.video)
video.video.save("example2.mp4")
print("Generated video saved to example2.mp4")
