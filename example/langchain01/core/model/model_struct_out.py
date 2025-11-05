"""
结构化输出
Pydantic: 参数的类型，字段验证
TypeDict: 不需要验证参数,底层就是字典
JsonSchema: 最基本的描述

下面会以Pydantic为例，因为工具的调用,对参数类型，格式都有要求。
不校验，直接调用带来一些没有意义的操作。
不如快速失败
"""
import os
from dotenv import load_dotenv

load_dotenv()
from langchain_openai import ChatOpenAI
from pydantic import BaseModel,Field

class City(BaseModel):
    name: str = Field(..., description="城市名称")
    position: str = Field(..., description="方位")
    population: int = Field(..., description="人口")

basic_model = ChatOpenAI(api_key=os.getenv("DASHSCOPE_API_KEY"),
                         base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                         model="deepseek-v3")


model_with_structure = basic_model.with_structured_output(City, include_raw=True,method="function_calling")
r = model_with_structure.invoke("请给我介绍下中国上海")
print(r['raw'])
print(r['parsed'])
print(r['parsing_error'])



