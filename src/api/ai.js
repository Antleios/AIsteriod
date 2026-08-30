import { requestSessionAiReply } from './training.js'

/**
 * 向小星获取回复 —— 页面唯一的 AI 入口。
 *
 * 所有患者消息只走带训练会话的后端接口，确保患者发言、模型回复和
 * 模型审计信息都落库。这里不做本地回复降级，否则医生端会缺少记录。
 *
 * @param {string | {role:'user'|'assistant',content:string}[]} messages
 *   字符串 → 单条用户发言；数组 → 完整对话历史（可直接喂给真实 LLM）
 * @returns {Promise<{reply: string}>}
 */
export async function requestAIMessage(messages, options = {}) {
  const payload = {
    messages:
      typeof messages === 'string'
        ? [{ role: 'user', content: messages }]
        : messages,
  }

  const latestUserMessage = [...payload.messages]
    .reverse()
    .find((message) => message.role === 'user')
  const trigger = options.trigger ?? 'USER_MESSAGE'
  const interaction = await requestSessionAiReply({
    clientRequestId: options.clientRequestId,
    userText: latestUserMessage?.content,
    inputMethod: options.inputMethod ?? 'TEXT',
    context: 'CHAT',
    trigger,
  })

  if (!interaction?.reply) {
    throw new Error('请先使用患者账号登录后再开始 AI 对话')
  }

  return { reply: interaction.reply, emotion: interaction.emotion }
}
