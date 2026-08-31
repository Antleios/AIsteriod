import { z } from 'zod'

const GAME_CODES = ['object-naming', 'emoji-match', 'color-line']
const EVENT_TYPES = [
  'GAME_START',
  'CORRECT',
  'WRONG',
  'MULTIPLE_WRONG',
  'IDLE',
  'LONG_IDLE',
  'USER_MESSAGE',
  'LEVEL_COMPLETE',
  'GAME_COMPLETE',
  'USER_QUIT',
  'QUESTION_REVEALED',
]

const jsonRecordSchema = z.record(z.string(), z.unknown())

export const createTrainingSessionSchema = z
  .object({
    metadata: jsonRecordSchema.optional(),
  })
  .strict()

export const createGameRunSchema = z
  .object({
    gameCode: z.enum(GAME_CODES),
  })
  .strict()

export const recordAttemptSchema = z
  .object({
    inputMethod: z.enum(['ASR', 'TEXT']).optional(),
    answer: z.string().trim().max(200).nullable().optional(),
    action: z.enum(['ANSWER', 'REVEAL']).default('ANSWER'),
    responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
  })
  .strict()

export const recordEventsSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            clientEventId: z
              .string()
              .trim()
              .min(1)
              .max(96)
              .regex(/^[a-zA-Z0-9._:-]+$/, '事件 ID 格式无效'),
            type: z.enum(EVENT_TYPES),
            gameRunId: z.string().cuid().optional(),
            occurredAt: z
              .coerce
              .date()
              .refine(
                (value) =>
                  value.getTime() >= Date.now() - 31 * 24 * 60 * 60 * 1_000 &&
                  value.getTime() <= Date.now() + 5 * 60 * 1_000,
                '事件时间必须在最近 31 天内，且不能早于服务器时间 5 分钟以上',
              )
              .optional(),
            data: jsonRecordSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()

export const recordConversationSchema = z
  .object({
    role: z.enum(['USER', 'ASSISTANT']),
    context: z.enum(['CHAT', 'OBJECT_NAMING', 'EMOJI_MATCH', 'COLOR_LINE']).default('CHAT'),
    content: z.string().trim().min(1).max(2_000),
    inputMethod: z.enum(['ASR', 'TEXT', 'SYSTEM']).optional(),
    responseLatencyMs: z.number().int().min(0).max(3_600_000).optional(),
    isUserInitiated: z.boolean().optional(),
    metadata: jsonRecordSchema.optional(),
  })
  .strict()

export const createCareAssignmentSchema = z
  .object({
    clinicianId: z.number().int().positive(),
    patientId: z.number().int().positive(),
  })
  .strict()

export function serializeValidationIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))
}
