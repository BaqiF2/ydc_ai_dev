from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain_openai import  ChatOpenAI

import os
import dotenv
dotenv.load_dotenv()


class ContactInfo(BaseModel):
    """Contact information for a person."""
    name: str = Field(description="The name of the person")
    email: str = Field(description="The email address of the person")
    phone: str = Field(description="The phone number of the person")

basic_model = ChatOpenAI(model="gpt-5",api_key=os.getenv("OPENAI_AI_KEY"),base_url=os.getenv("OPEN_AI_URL"))

agent = create_agent(
    model=basic_model,
    tools=[],
    response_format=ContactInfo
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567"}]
})


for message in result['messages']:
    message.pretty_print()

# 输出
# ================================ Human Message =================================
#
# Extract contact info from: John Doe, john@example.com, (555) 123-4567
# ================================== Ai Message ==================================
#
# {"email":"john@example.com","name":"John Doe","phone":"(555) 123-4567"}