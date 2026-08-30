import { z } from 'zod'

const GAME_CODES = ['object-naming', 'emoji-match', 'color-line']

const patientUsernameSchema = z
  .string()
  .trim()
  .min(3, '患者用户名至少需要 3 个字符')
  .max(32, '患者用户名不能超过 32 个字符')
  .regex(/^[a-zA-Z0-9._-]+$/, '患者用户名格式无效')
  .transform((value) => value.toLowerCase())

const nullableText = (max, message) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable()
    .optional()

export const dashboardQuerySchema = z
  .object({
    range: z.enum(['7d', '30d', '90d']).default('30d'),
  })
  .strict()

export const trainingRecordsQuerySchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    gameCode: z.enum(GAME_CODES).optional(),
    q: z.string().trim().min(1).max(80).optional(),
  })
  .strict()

export const patientsQuerySchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().min(1).max(80).optional(),
  })
  .strict()

export const patientOverviewQuerySchema = z
  .object({
    range: z.enum(['7d', '30d', '90d']).default('30d'),
  })
  .strict()

export const conversationSummariesQuerySchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().min(1).max(80).optional(),
  })
  .strict()

export const assignPatientSchema = z
  .object({
    username: patientUsernameSchema,
  })
  .strict()

export const patientProfileSchema = z
  .object({
    age: z.number().int().min(0).max(120).nullable().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).nullable().optional(),
    diagnosis: nullableText(500, '诊断说明不能超过 500 个字符'),
    caseNotes: nullableText(2000, '病例备注不能超过 2000 个字符'),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, '至少需要提供一个档案字段')
