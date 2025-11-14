from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Math")


@mcp.tool()
def add(a: float, b: float) -> float:
    """
    两个数相加
    :param a: 左边的值
    :param b: 右边的值
    :return: a+b的和
    """
    return a + b


@mcp.tool()
def multiply(a: float, b: float) -> float:
    """
    两个数相乘
    :param a:
    :param b:
    :param a: 左边的值
    :param b: 右边的值
    :return: a * b的值
    """
    return a * b


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
