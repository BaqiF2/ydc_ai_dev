/**
 * 消息类型定义
 */
interface MessageContent {
    text?: string;
    name?: string;
}

interface QueryMessage {
    type: string;
    message?: {
        content?: MessageContent[];
    };
    subtype?: string;
}

/**
 * 消息打印工具类
 * 用于处理和打印 Claude Agent SDK 的查询流消息
 */
export class MessagePrinter {
    /**
     * 打印单个消息
     * @param message - 查询流消息对象
     */
    static printMessage(message: QueryMessage): void {
        if (message.type === "assistant" && message.message?.content) {
            this.printAssistantMessage(message.message.content);
        } else if (message.type === "result") {
            this.printResult(message.subtype);
        }
    }

    /**
     * 打印助手消息内容
     * @param content - 消息内容块数组
     */
    private static printAssistantMessage(content: MessageContent[]): void {
        for (const block of content) {
            if ("text" in block && block.text) {
                console.log(block.text);             // Claude's reasoning
            } else if ("name" in block && block.name) {
                console.log(`Tool: ${block.name}`);  // Tool being called
            }
        }
    }

    /**
     * 打印结果消息
     * @param subtype - 结果子类型
     */
    private static printResult(subtype: string | undefined): void {
        console.log(`Done: ${subtype}`);
    }

    /**
     * 批量打印消息流
     * @param messages - 消息流的异步迭代器
     */
    static async printMessageStream(messages: AsyncIterable<QueryMessage>): Promise<void> {
        for await (const message of messages) {
            this.printMessage(message);
        }
    }
}

