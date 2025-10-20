from enum import Enum
from langchain_openai import ChatOpenAI
import os


class Constants(Enum):
    ALI_TONGYI_API_KEY_SYSVAR_NAME = "DASHSCOPE_API_KEY"
    ALI_TONGYI_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ALI_TONGYI_MAX_MODEL = "qwen3-max"
    ALI_TONGYI_DEEPSEEK_R1 = "deepseek-r1"
    ALI_TONGYI_DEEPSEEK_V3 = "deepseek-v3"
    ALI_TONGYI_REASONER_MODEL = "qvq-max-latest"
    ALI_TONGYI_EMBEDDING = "text-embedding-v3"
    ALI_TONGYI_RERANK = "gte-rerank-v2"
    QWEN_VL_MAX_MODEL = "qwen-vl-max"



def openai_tongyi_chat_model() -> ChatOpenAI:
    return ChatOpenAI(api_key=os.getenv(Constants.ALI_TONGYI_API_KEY_SYSVAR_NAME.value),
                      base_url=Constants.ALI_TONGYI_URL.value,
                      model=Constants.ALI_TONGYI_MAX_MODEL.value)

