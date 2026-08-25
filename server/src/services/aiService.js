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

const DOCTOR_PROMPT_VERSION = 'session-summary-v1'
const QWEN_CHAT_URL =
  process.env.QWEN_BASE_URL ??
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

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

function formatPercent(value) {
  return value === null || value === undefined ? '数据不足' : `${Math.round(value * 100)}%`
}

function createDeterministicDoctorSummary(input) {
  const gamePerformance = input.games.map((game) => ({
    game: game.title,
    summary:
      `${game.title}：正确率${formatPercent(game.accuracy)}，` +
      `平均反应时间${game.averageResponseTimeMs ?? '数据不足'}毫秒，` +
      `错误${game.wrongCount}次，无操作${game.idleCount}次。`,
  }))
  const observedLanguageBehavior = input.relevantTranscript.map(
    (sample) => `在${sample.context}场景中，用户说：“${sample.user}”。`,
  )

  return {
    sessionOverview: `本次完成${input.games.length}项游戏训练，并记录${input.conversationMetrics.turnCount}轮对话。`,
    gamePerformance,
    interactionSummary:
      `用户发言${input.conversationMetrics.userUtteranceCount}次，` +
      `主动发起${input.conversationMetrics.userInitiatedCount}次，` +
      `长时间停顿${input.conversationMetrics.longPauseCount}次。`,
    observedLanguageBehavior: observedLanguageBehavior.length
      ? observedLanguageBehavior
      : ['本次没有足够的用户语音或文本记录可供判断。'],
    comparisonWithinSession: '本摘要仅描述本次会话中的可观察数据，不构成医学诊断或长期推断。',
  }
}

function doctorSystemPrompt() {
  return `你是康复训练记录摘要助手。仅根据给定 JSON 生成医生端阅读摘要。
要求：准确描述客观游戏表现和可观察交互；不得进行医学诊断、推断未表达的心理状态，或把一次训练推广为长期特征；数据不足时明确说明。只返回 JSON，字段必须为 sessionOverview、gamePerformance、interactionSummary、observedLanguageBehavior、comparisonWithinSession。`
}

function parseQwenSummary(content) {
  const normalized = String(content ?? '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '')
  const result = JSON.parse(normalized)

  if (
    !result ||
    typeof result.sessionOverview !== 'string' ||
    !Array.isArray(result.gamePerformance) ||
    typeof result.interactionSummary !== 'string' ||
    !Array.isArray(result.observedLanguageBehavior) ||
    typeof result.comparisonWithinSession !== 'string'
  ) {
    throw new Error('Qwen summary response does not match the required schema')
  }

  return result
}

async function generateQwenDoctorSummary(input) {
  if (!process.env.QWEN_API_KEY) {
    throw new Error('QWEN_API_KEY is required when AI_PROVIDER=qwen')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(QWEN_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.QWEN_DOCTOR_MODEL ?? 'qwen-plus',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: doctorSystemPrompt() },
          { role: 'user', content: JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Qwen summary request failed with HTTP ${response.status}`)
    }

    const body = await response.json()
    return parseQwenSummary(body.choices?.[0]?.message?.content)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 生成医生摘要，与面向患者的 getAiReply 保持独立。
 * 默认 deterministic 模式用于本地开发和测试；设置 AI_PROVIDER=qwen 才会出网。
 */
export async function generateDoctorSummary(input) {
  if (process.env.AI_PROVIDER === 'qwen') {
    return {
      provider: 'qwen',
      promptVersion: DOCTOR_PROMPT_VERSION,
      result: await generateQwenDoctorSummary(input),
    }
  }

  return {
    provider: 'deterministic',
    promptVersion: DOCTOR_PROMPT_VERSION,
    result: createDeterministicDoctorSummary(input),
  }
}
