/**
 * 生成小星的回复。
 *
 * ⚠️ 真实 LLM 接入点 —— 换掉 getAiReply() 的 mock 即可：
 *
 *   1. 安装 SDK：npm i openai  （或 @anthropic-ai/sdk / deepseek 等）
 *   2. 在 server/.env 加 API Key（如 OPENAI_API_KEY）
 *   3. 用 provider 调用替换 getAiReply() 主体，把 messages
 *      ({role, content}) 映射成该 provider 的消息格式
 *   4. 返回的文本保持 {reply} 结构不变，路由无需改动
 *
 * 流式（SSE）方案：把 getAiReply 改为接收 Express 的 res，
 * 设置 Content-Type: text/event-stream，逐块写入
 * `data: {"delta":"..."}\n\n`，结束写 `event: done\ndata: {}\n\n`。
 * 前端把 requestAIMessage() 换成 fetch 流读取器，逐块追加并喂给
 * speechSynthesis 分句朗读即可。
 */

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

export async function getAiReply(messages) {
  // ← 真实的 LLM provider 调用在这里替换 mock
  await new Promise((resolve) => setTimeout(resolve, 350)) // 模拟网络延迟
  return mockReply(messages)
}
