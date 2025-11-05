"""
定义一个工具，使用自定义的参数
"""
from typing import Literal

from langchain_core.tools import tool
from pydantic import BaseModel, Field

class WeatherInput(BaseModel):
    """Input for weather queries."""
    location: str = Field(description="City name or coordinates")
    units: Literal["celsius", "fahrenheit"] = Field(
        default="北京",
        description="Temperature unit preference"
    )
    include_forecast: bool = Field(
        default=False,
        description="Include 5-day forecast"
    )

@tool(name_or_callable="weather_search",description="查询天气",args_schema=WeatherInput)
def weather_search(location: str, units: str = "celsius", include_forecast: bool = False):
    """Get current weather and optional forecast."""
    temp = 22 if units == "celsius" else 72
    result = f"Current weather in {location}: {temp} degrees {units[0].upper()}"
    if include_forecast:
        result += "\nNext 5 days: Sunny"
    return result


r = weather_search.invoke(input="",location="北京",units="celsius",include_forecast=True)
print(r)
print(weather_search.args)