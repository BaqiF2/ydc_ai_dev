import { query } from "@anthropic-ai/claude-agent-sdk"

/**
 * 会话分叉（Fork Session）示例
 * 
 * 功能说明：
 * 1. 会话分叉允许在保留原始会话的同时，创建一个新的分支会话
 * 2. 分叉会话会继承原始会话的所有上下文和历史记录
 * 3. 原始会话和分叉会话互不影响，可以独立发展
 * 
 * 使用场景：
 * - 尝试不同的解决方案或设计方案
 * - 在不影响主会话的情况下进行实验性探索
 * - 创建多个并行的对话分支
 */

// 步骤1: 捕获原始会话ID
// 用于后续恢复或分叉会话
let sessionId: string | undefined

// 创建初始会话，请求设计REST API
const response = query({
  prompt: "Help me design a REST API",
  options: { model: "claude-sonnet-4-5" ,systemPrompt:"使用中文回复"}
})

// 遍历响应消息流，获取会话ID
for await (const message of response) {
  // 检查是否为系统初始化消息
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id
    console.log(`原始会话ID: ${sessionId}`)
  }
}

// 步骤2: 分叉会话以尝试不同的方案
// 这将创建一个新的会话ID，但继承原始会话的所有上下文
const forkedResponse = query({
  prompt: "Now let's redesign this as a GraphQL API instead",
  options: {
    resume: sessionId,  // 指定要分叉的原始会话ID
    forkSession: true,  // 关键参数：创建新的会话分支而不是直接继续原会话
    model: "claude-sonnet-4-5",
    systemPrompt:"使用中文回复"
  }
})

// 获取并输出分叉后的新会话ID
for await (const message of forkedResponse) {
  if (message.type === 'system' && message.subtype === 'init') {
    console.log(`分叉会话ID: ${message.session_id}`)
    // 注意：这将是一个与原始会话不同的新会话ID
  }
}

// 步骤3: 继续使用原始会话
// 原始会话保持不变，不受分叉会话的影响，仍然可以被恢复和继续使用
const originalContinued = query({
  prompt: "Add authentication to the REST API",
  options: {
    resume: sessionId,  // 使用原始会话ID
    forkSession: false,  // 不分叉，直接继续原会话（这是默认行为）
    model: "claude-sonnet-4-5",
    systemPrompt:"使用中文回复"
  }
})

// 获取并输出分叉后的新会话ID
for await (const message of originalContinued) {
    if (message.type === 'system' && message.subtype === 'init') {
      console.log(`继续的会话ID: ${message.session_id}`)
    }
}