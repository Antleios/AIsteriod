import { z } from 'zod'

const interactionTriggers = [
  'CHAT_START',
  'GAME_START',
  'MULTIPLE_WRONG',
  'LONG_IDLE',
  'USER_MESSAGE',
  'USER_QUIT',
  'GAME_COMPLETE',
]

const contexts = ['CHAT', 'OBJECT_NAMING', 'EMOJI_MATCH', 'COLOR_LINE']
export const PATIENT_INTERACTION_INPUT_SCHEMA_VERSION = 'patient-interaction-input.v1'
export const PATIENT_INTERACTION_OUTPUT_SCHEMA_VERSION = 'patient-interaction-output.v1'
export const SESSION_CONVERSATION_MEMORY_INPUT_SCHEMA_VERSION =
  'session-conversation-memory-input.v1'
export const SESSION_CONVERSATION_MEMORY_OUTPUT_SCHEMA_VERSION =
  'session-conversation-memory-output.v1'
export const DOCTOR_SUMMARY_INPUT_SCHEMA_VERSION = 'doctor-summary-input.v1'
export const DOCTOR_SUMMARY_OUTPUT_SCHEMA_VERSION = 'doctor-summary-output.v1'
export const PATIENT_EMOTIONS = [
  'neutral',
  'encouraging',
  'calm',
  'celebrating',
  'empathetic',
]
const jsonRecordSchema = z.record(z.string(), z.unknown())
const messageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })
  .strict()

export const chatSchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(10),
  })
  .strict()

export const sessionInteractionSchema = z
  .object({
    clientRequestId: z
      .string()
      .trim()
      .min(1)
      .max(96)
      .regex(/^[a-zA-Z0-9._:-]+$/, '请求 ID 格式无效'),
    trigger: z.enum(interactionTriggers),
    context: z.enum(contexts).default('CHAT'),
    gameRunId: z.string().cuid().optional(),
    questionId: z.string().cuid().optional(),
    userText: z.string().trim().min(1).max(2_000).optional(),
    inputMethod: z.enum(['ASR', 'TEXT']).default('TEXT'),
    gameState: jsonRecordSchema.optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.trigger === 'USER_MESSAGE' && !input.userText) {
      ctx.addIssue({
        code: 'custom',
        path: ['userText'],
        message: '用户发言触发时必须提供 userText',
      })
    }
  })

const patientReplyContentSchema = z
  .object({
    reply: z.string().trim().min(1).max(1_000),
    emotion: z.enum(PATIENT_EMOTIONS),
  })
  .strict()

export const patientInteractionOutputSchema = patientReplyContentSchema.extend({
  schemaVersion: z.literal(PATIENT_INTERACTION_OUTPUT_SCHEMA_VERSION),
})

const sessionConversationMemoryContentSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_000),
    continuityNotes: z.array(z.string().trim().min(1).max(240)).max(6),
  })
  .strict()

export const sessionConversationMemoryOutputSchema =
  sessionConversationMemoryContentSchema.extend({
    schemaVersion: z.literal(SESSION_CONVERSATION_MEMORY_OUTPUT_SCHEMA_VERSION),
  })

export const sessionConversationMemoryContentOutputSchema = sessionConversationMemoryContentSchema

export const doctorSummaryContentSchema = z
  .object({
    sessionOverview: z.string().trim().min(1),
    gamePerformance: z.array(z.unknown()),
    interactionSummary: z.string().trim().min(1),
    observedLanguageBehavior: z.array(z.string()),
    comparisonWithinSession: z.string().trim().min(1),
  })
  .strict()

export const doctorSummaryOutputSchema = doctorSummaryContentSchema.extend({
  schemaVersion: z.literal(DOCTOR_SUMMARY_OUTPUT_SCHEMA_VERSION),
})

export function createPatientInteractionInput(input) {
  return {
    schemaVersion: PATIENT_INTERACTION_INPUT_SCHEMA_VERSION,
    interaction: {
      trigger: input.trigger,
      context: input.context,
      gameRunId: input.gameRunId ?? null,
    },
    user: input.userText
      ? { text: input.userText, inputMethod: input.inputMethod }
      : null,
    gameState: input.gameState ?? null,
    previousSessionMemory: input.previousSessionMemory ?? null,
    recentConversation: (input.recentConversation ?? []).slice(-10).map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: String(turn.content).slice(0, 2_000),
      context: turn.context,
    })),
  }
}

export function createSessionConversationMemoryInput(input) {
  const selectedTurns = (input.conversationTurns ?? []).slice(-60).reverse()
  let remainingCharacters = 12_000
  const conversation = []

  for (const turn of selectedTurns) {
    if (remainingCharacters <= 0) break
    const content = String(turn.content ?? '').slice(0, Math.min(1_000, remainingCharacters))
    if (!content) continue
    conversation.push({
      role: turn.role === 'ASSISTANT' ? 'assistant' : 'user',
      context: turn.context,
      content,
    })
    remainingCharacters -= content.length
  }

  return {
    schemaVersion: SESSION_CONVERSATION_MEMORY_INPUT_SCHEMA_VERSION,
    conversation: conversation.reverse(),
  }
}

export function createDoctorSummaryInput(input) {
  return {
    schemaVersion: DOCTOR_SUMMARY_INPUT_SCHEMA_VERSION,
    session: input,
  }
}

export function serializeValidationIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))
}
