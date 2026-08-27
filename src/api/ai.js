import { apiPost } from './client.js'
import { requestSessionAiReply } from './training.js'

const MOCK_REPLIES = [
  '好的，我听到啦！你能再说具体一点吗？',
  '原来是这样，听起来很有意思呢！',
  '嗯嗯，我在认真听你说哦。',
  '谢谢你告诉我这些！你今天感觉怎么样呀？',
  '真棒！你可以试着多说几句话，我很愿意陪你聊天。',
]

function mockReply(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user')
  const text = last?.content ?? ''
  if (/你好|您好|嗨|哈喽/.test(text)) {
    return '你好呀！我是小星，很高兴见到你！今天想聊点什么呢？'
  }
  if (/谢谢|感谢/.test(text)) {
    return '不客气！能帮到你我很开心！'
  }
  return MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)]
}

/**
 * 向小星获取回复 —— 页面唯一的 AI 入口。
 *
 * 现在的实现：POST 到后端 /api/ai/chat（后端目前是 mock），
 * 后端不可用时回退到本地 mock（遵循项目「后端不可用回退本地题库」的惯例）。
 *
 * 将来接入真实 AI：只需改这里（或后端 aiService.js），页面本身不用动。
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

  try {
    const latestUserMessage = [...payload.messages].reverse().find((message) => message.role === 'user')
    if (latestUserMessage) {
      const interaction = await requestSessionAiReply({
        userText: latestUserMessage.content,
        inputMethod: options.inputMethod ?? 'TEXT',
        context: 'CHAT',
      })
      if (interaction?.reply) {
        return { reply: interaction.reply, emotion: interaction.emotion }
      }
    }

    const data = await apiPost('/api/ai/chat', payload)
    return { reply: data.reply ?? '', emotion: data.emotion }
  } catch (error) {
    console.warn('AI 服务暂不可用，使用本地模拟回复：', error)
    return { reply: mockReply(payload.messages) }
  }
}
