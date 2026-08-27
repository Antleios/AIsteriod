import {
  createDoctorSummaryInput,
  createPatientInteractionInput,
  doctorSummaryContentSchema,
  doctorSummaryOutputSchema,
  DOCTOR_SUMMARY_OUTPUT_SCHEMA_VERSION,
  patientInteractionOutputSchema,
  PATIENT_INTERACTION_OUTPUT_SCHEMA_VERSION,
} from '../validation/aiSchemas.js'
import {
  createPromptMessage,
  resolveDoctorSummaryPrompt,
  resolvePatientInteractionPrompt,
} from './aiPrompts.js'

const QWEN_CHAT_URL =
  process.env.QWEN_BASE_URL ??
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

function configuredProvider(scope) {
  return process.env[`AI_${scope}_PROVIDER`] ?? process.env.AI_PROVIDER ?? 'deterministic'
}

function configuredModel(name, fallback) {
  return process.env[name] ?? fallback
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

function deterministicPatientReply({ interaction, user }) {
  if (interaction.trigger === 'LONG_IDLE') {
    return { reply: '我们可以慢慢看，不着急。', emotion: 'calm' }
  }
  if (interaction.trigger === 'MULTIPLE_WRONG') {
    return { reply: '没关系，我们可以慢慢来，再试一次。', emotion: 'encouraging' }
  }
  if (interaction.trigger === 'USER_QUIT' || /不喜欢|不想|停止|休息/.test(user?.text ?? '')) {
    return { reply: '好，我知道了。我们可以先停一下。', emotion: 'empathetic' }
  }
  if (interaction.trigger === 'GAME_COMPLETE') {
    return { reply: '你完成啦，刚才很认真。', emotion: 'celebrating' }
  }
  if (interaction.trigger === 'GAME_START') {
    return { reply: '我们慢慢开始，不着急。', emotion: 'encouraging' }
  }
  return { reply: '嗯嗯，我在认真听你说哦。', emotion: 'neutral' }
}

function parseJsonResponse(content) {
  const normalized = String(content ?? '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(normalized)
}

function validateModelOutput(schema, content, name) {
  const parsed = schema.safeParse(parseJsonResponse(content))
  if (!parsed.success) throw new Error(`${name} response does not match the required schema`)
  return parsed.data
}

async function requestQwenJson({ model, temperature, prompt, input }) {
  if (!process.env.QWEN_API_KEY) {
    throw new Error('QWEN_API_KEY is required when the Qwen provider is enabled')
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
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: JSON.stringify(createPromptMessage(prompt)) },
          { role: 'user', content: JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Qwen request failed with HTTP ${response.status}`)
    const body = await response.json()
    return body.choices?.[0]?.message?.content
  } finally {
    clearTimeout(timeout)
  }
}

function patientOutput(content) {
  return patientInteractionOutputSchema.parse({
    schemaVersion: PATIENT_INTERACTION_OUTPUT_SCHEMA_VERSION,
    ...content,
  })
}

function doctorOutput(content) {
  return doctorSummaryOutputSchema.parse({
    schemaVersion: DOCTOR_SUMMARY_OUTPUT_SCHEMA_VERSION,
    ...content,
  })
}

async function generateQwenDoctorSummary(input, prompt) {
  const content = validateModelOutput(
    doctorSummaryContentSchema,
    await requestQwenJson({
      model: configuredModel('QWEN_DOCTOR_MODEL', 'qwen-plus'),
      temperature: prompt.temperature,
      prompt,
      input,
    }),
    'Qwen doctor summary',
  )
  return doctorOutput(content)
}

async function generateQwenPatientReply(input, prompt) {
  const content = validateModelOutput(
    patientInteractionOutputSchema.omit({ schemaVersion: true }),
    await requestQwenJson({
      model: configuredModel('QWEN_CHARACTER_MODEL', 'qwen-plus-character'),
      temperature: prompt.temperature,
      prompt,
      input,
    }),
    'Qwen patient interaction',
  )
  return patientOutput(content)
}

function metadata(provider, model, prompt, input) {
  return {
    provider,
    model,
    prompt: { id: prompt.id, version: prompt.version },
    inputSchemaVersion: input.schemaVersion,
  }
}

export function isPatientInteractionProviderLive() {
  return configuredProvider('INTERACTION') === 'qwen'
}

// Compatibility adapter for the existing chat page. It accepts the legacy message
// list but normalizes it into the same structured contract used by session calls.
export async function getAiChatResponse(messages) {
  const recentConversation = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-10)
  const userText = [...recentConversation]
    .reverse()
    .find((message) => message.role === 'user')?.content

  return generatePatientInteractionReply(
    createPatientInteractionInput({
      trigger: 'USER_MESSAGE',
      context: 'CHAT',
      userText,
      inputMethod: 'TEXT',
      recentConversation,
    }),
  )
}

export async function generatePatientInteractionReply(input) {
  const prompt = resolvePatientInteractionPrompt()
  const provider = configuredProvider('INTERACTION')
  const model =
    provider === 'qwen' ? configuredModel('QWEN_CHARACTER_MODEL', 'qwen-plus-character') : null
  const output =
    provider === 'qwen'
      ? await generateQwenPatientReply(input, prompt)
      : patientOutput(deterministicPatientReply(input))

  return {
    ...metadata(provider, model, prompt, input),
    output,
    // Compatibility for service callers introduced before the explicit output
    // envelope. New callers should use `output` and `prompt`.
    result: output,
    promptVersion: prompt.version,
  }
}

export async function generateDoctorSummary(summary) {
  const prompt = resolveDoctorSummaryPrompt()
  const input = createDoctorSummaryInput(summary)
  const provider = configuredProvider('DOCTOR')
  const model = provider === 'qwen' ? configuredModel('QWEN_DOCTOR_MODEL', 'qwen-plus') : null
  const output =
    provider === 'qwen'
      ? await generateQwenDoctorSummary(input, prompt)
      : doctorOutput(createDeterministicDoctorSummary(summary))

  return {
    ...metadata(provider, model, prompt, input),
    output,
    // Existing session-summary consumers use `result`; keep it as the validated
    // JSON output while new code can use the explicit `output` field.
    result: output,
    promptVersion: prompt.version,
  }
}
