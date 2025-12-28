import { query, HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
// @ts-ignore
import { MessagePrinter } from "./message-printer";

// 使用 HookCallback 类型定义钩子回调
// @ts-ignore
const protectEnvFiles: HookCallback = async (input, toolUseID, { signal }) => {
    // 将输入转换为特定钩子类型以获得类型安全
    const preInput = input as PreToolUseHookInput;

    // 从工具的输入参数中提取文件路径
    // @ts-ignore
    const filePath = preInput.tool_input?.file_path as string;
    const fileName = filePath?.split('/').pop();

    // 如果目标是 .env 文件，则阻止操作
    if (fileName === '.env') {
        return {
            hookSpecificOutput: {
                hookEventName: input.hook_event_name,
                permissionDecision: 'deny',
                permissionDecisionReason: 'Cannot modify .env files'
            }
        };
    }

    // 返回空对象以允许操作
    return {};
};

// 使用 MessagePrinter 工具类打印消息流
(async () => {
    await MessagePrinter.printMessageStream(query({
        prompt: "Update the database configuration",
        options: {
            hooks: {
                // 为 PreToolUse 事件注册钩子
                // 匹配器仅过滤 Write 和 Edit 工具调用
                PreToolUse: [{ matcher: 'Write|Edit', hooks: [protectEnvFiles] }]
            }
        }
    }));
})();