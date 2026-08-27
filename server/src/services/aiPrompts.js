const promptDefinitions = {
  patientInteraction: {
    id: 'patient-interaction',
    version: 'patient-interaction-v1',
    temperature: 0.6,
    instructions: [
      '你是“小星”，一名面向康复训练用户的温和互动伙伴。',
      '仅根据输入 JSON 中的当前场景、事件和最近对话自然回应。',
      '回复 1 到 2 句，语言简单、温和、没有催促感。',
      '不要给出题目答案、暗示正确选项或替代游戏规则。',
      '不要进行医学诊断或推断用户未表达的心理状态。',
      '用户表示不想继续时尊重其选择。',
    ],
    outputSchema: {
      type: 'object',
      required: ['reply', 'emotion'],
      additionalProperties: false,
      properties: {
        reply: { type: 'string', maxLength: 240 },
        emotion: {
          type: 'string',
          enum: ['neutral', 'encouraging', 'calm', 'celebrating', 'empathetic'],
        },
      },
    },
  },
  doctorSummary: {
    id: 'doctor-summary',
    version: 'session-summary-v1',
    temperature: 0.2,
    instructions: [
      '你是康复训练记录摘要助手。仅根据输入 JSON 生成医生端阅读摘要。',
      '准确描述客观游戏表现和可观察交互。',
      '不得进行医学诊断、推断未表达的心理状态，或把一次训练推广为长期特征。',
      '数据不足时明确说明。',
    ],
    outputSchema: {
      type: 'object',
      required: [
        'sessionOverview',
        'gamePerformance',
        'interactionSummary',
        'observedLanguageBehavior',
        'comparisonWithinSession',
      ],
      additionalProperties: false,
    },
  },
}

function resolvePrompt(name, configuredVersion) {
  const prompt = promptDefinitions[name]
  if (!prompt) throw new Error(`Unknown AI prompt: ${name}`)
  if (configuredVersion && configuredVersion !== prompt.version) {
    throw new Error(`Unsupported ${name} prompt version: ${configuredVersion}`)
  }
  return prompt
}

export function resolvePatientInteractionPrompt() {
  return resolvePrompt('patientInteraction', process.env.AI_INTERACTION_PROMPT_VERSION)
}

export function resolveDoctorSummaryPrompt() {
  return resolvePrompt('doctorSummary', process.env.AI_DOCTOR_PROMPT_VERSION)
}

// Keep prompts as data so new versions can be added and selected by environment
// without changing route or persistence code. Client requests never choose a prompt.
export function createPromptMessage(prompt) {
  return {
    schemaVersion: 'ai-prompt.v1',
    prompt: { id: prompt.id, version: prompt.version },
    instructions: prompt.instructions,
    outputSchema: prompt.outputSchema,
    responseRule: '只返回与 outputSchema 匹配的 JSON 对象，不要 Markdown 或额外字段。',
  }
}
