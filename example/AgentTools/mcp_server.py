"""
简单的MCP服务器示例 - 提供查询当前时间的功能

这个示例展示了如何使用FastMCP创建一个简单的MCP服务器，
提供工具(tools)、资源(resources)功能。

主要功能：
1. 查询当前时间的工具（支持不同时区和格式）
2. 时区列表查询和时区对比
3. 服务器信息资源（通过URI访问）

运行方式：
    # 使用stdio传输（默认，用于与AI客户端通信）
    python mcp_server.py
    
    # 使用HTTP传输（用于Web应用）
    python mcp_server.py --transport streamable-http
    
    # 指定端口
    python mcp_server.py --transport streamable-http --port 8000
"""

from datetime import datetime
from typing import Any, Literal

import pytz
from mcp.server.fastmcp import FastMCP

# 创建FastMCP服务器实例
mcp = FastMCP[Any]("Time Service")

@mcp.tool()
def get_current_time(
    timezone: str = "UTC",
    format: Literal["iso", "readable", "timestamp"] = "iso"
) -> str:
    """
    获取当前时间
    
    Args:
        timezone: 时区，例如 'UTC', 'Asia/Shanghai', 'America/New_York'
        format: 返回格式
            - iso: ISO 8601格式 (默认)
            - readable: 可读格式
            - timestamp: Unix时间戳
    
    Returns:
        格式化的当前时间字符串
    """
    try:
        # 获取指定时区
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)
        
        # 根据格式返回不同的时间表示
        if format == "iso":
            return now.isoformat()
        elif format == "readable":
            return now.strftime("%Y年%m月%d日 %H:%M:%S %Z")
        elif format == "timestamp":
            return str(int(now.timestamp()))
        else:
            return now.isoformat()
    except Exception as e:
        return f"错误: {str(e)}"


@mcp.tool()
def get_timezone_list(region: str = "all") -> str:
    """
    获取可用的时区列表
    
    Args:
        region: 地区筛选，如 'Asia', 'America', 'Europe' 或 'all' (默认)
    
    Returns:
        时区列表的字符串表示
    """
    try:
        all_timezones = pytz.all_timezones
        
        if region.lower() == "all":
            timezones = all_timezones
        else:
            # 按地区筛选
            timezones = [tz for tz in all_timezones if tz.startswith(region)]
        
        # 限制返回数量，避免过长
        max_display = 50
        if len(timezones) > max_display:
            result = "\n".join(timezones[:max_display])
            result += f"\n... (共 {len(timezones)} 个时区，仅显示前 {max_display} 个)"
        else:
            result = "\n".join(timezones)
        
        return result
    except Exception as e:
        return f"错误: {str(e)}"


@mcp.tool()
def compare_timezones(timezone1: str, timezone2: str) -> str:
    """
    比较两个时区的当前时间
    
    Args:
        timezone1: 第一个时区
        timezone2: 第二个时区
    
    Returns:
        两个时区的时间对比结果
    """
    try:
        tz1 = pytz.timezone(timezone1)
        tz2 = pytz.timezone(timezone2)
        
        now1 = datetime.now(tz1)
        now2 = datetime.now(tz2)
        
        # 计算时差
        diff = (now1.utcoffset() - now2.utcoffset()).total_seconds() / 3600
        
        result = f"""时区对比：
{timezone1}: {now1.strftime("%Y-%m-%d %H:%M:%S %Z")}
{timezone2}: {now2.strftime("%Y-%m-%d %H:%M:%S %Z")}
时差: {abs(diff):.1f} 小时 ({timezone1} {'领先' if diff > 0 else '落后'} {timezone2})
"""
        return result
    except Exception as e:
        return f"错误: {str(e)}"


# ==================== 资源定义 ====================

@mcp.resource("time://info")
def get_server_info() -> str:
    """
    服务器信息资源
    
    URI: time://info
    """
    return """{{
  "name": "Time Service MCP Server",
  "version": "1.0.0",
  "description": "简单的时间查询MCP服务器",
  "capabilities": [
    "获取当前时间（多时区支持）",
    "时区列表查询",
    "时区时间对比"
  ],
  "supported_timezones": "所有pytz支持的时区",
  "author": "ydc_ai_dev"
}}"""


# ==================== 主函数 ====================

def main():
    """
    MCP服务器入口函数
    支持命令行参数配置传输方式和端口
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Time Service MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http"],
        default="stdio",
        help="传输方式：stdio（默认，用于AI客户端）或 streamable-http（用于Web）"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="HTTP服务端口（仅在streamable-http模式下有效），默认8000"
    )
    
    args = parser.parse_args()
    
    # 打印启动信息
    print(f"Time Service MCP Server 启动中...")
    print(f"传输方式: {args.transport}")
    if args.transport == "streamable-http":
        print(f"访问地址: http://localhost:{args.port}/mcp")
    
    # 运行服务器
    if args.transport == "streamable-http":
        mcp.run(transport="streamable-http", port=args.port)
    else:
        # stdio模式下不打印到stdout，避免干扰MCP协议通信
        mcp.run()

if __name__ == "__main__":
    main()

