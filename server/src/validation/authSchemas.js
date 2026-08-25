import { z } from 'zod'
import { USER_ROLES } from '../config/auth.js'

const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名至少需要 3 个字符')
  .max(32, '用户名不能超过 32 个字符')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    '用户名只能包含字母、数字、点、下划线和连字符',
  )
  .transform((value) => value.toLowerCase())

const passwordSchema = z
  .string()
  .min(10, '密码至少需要 10 个字符')
  .max(128, '密码不能超过 128 个字符')

export const loginSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .strict()

export const createUserSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    displayName: z
      .string()
      .trim()
      .min(1, '显示名称不能为空')
      .max(50, '显示名称不能超过 50 个字符'),
    role: z.enum(USER_ROLES).default('PATIENT'),
  })
  .strict()

// 公开注册不允许创建管理员；医生账号必须由管理员审核后才可登录。
export const registerUserSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    displayName: z
      .string()
      .trim()
      .min(1, '显示名称不能为空')
      .max(50, '显示名称不能超过 50 个字符'),
    role: z.enum(['PATIENT', 'DOCTOR']).default('PATIENT'),
  })
  .strict()

export function serializeValidationIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))
}
