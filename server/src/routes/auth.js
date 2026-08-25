import { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import {
  authConfig,
  clearSessionCookieOptions,
  sessionCookieOptions,
} from '../config/auth.js'
import {
  loginWithPassword,
  revokeAllUserSessions,
  revokeSession,
} from '../services/authService.js'
import {
  loginSchema,
  serializeValidationIssues,
} from '../validation/authSchemas.js'
import {
  loadAuthentication,
  requireAuthentication,
} from '../middleware/auth.js'
import { createOriginGuard } from '../middleware/originGuard.js'

function loginRateLimitKey(req) {
  const username = String(req.body?.username ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 32)

  return `${ipKeyGenerator(req.ip)}:${username}`
}

export function createAuthRouter({ allowedOrigins }) {
  const router = Router()
  const originGuard = createOriginGuard(allowedOrigins)
  const loginLimiter = rateLimit({
    windowMs: authConfig.loginWindowMs,
    limit: authConfig.loginMaxAttempts,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: loginRateLimitKey,
    handler(req, res) {
      void req
      res.status(429).json({
        error: {
          code: 'TOO_MANY_LOGIN_ATTEMPTS',
          message: '登录尝试次数过多，请稍后再试',
        },
      })
    },
  })

  router.use((req, res, next) => {
    void req
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.post('/login', originGuard, loginLimiter, async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body)

      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数无效',
            details: serializeValidationIssues(parsed.error),
          },
        })
        return
      }

      const result = await loginWithPassword(parsed.data)

      if (!result) {
        res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '用户名或密码错误',
          },
        })
        return
      }

      res.cookie(
        authConfig.cookieName,
        result.token,
        sessionCookieOptions(),
      )
      res.json({
        user: result.user,
        session: { expiresAt: result.expiresAt },
      })
    } catch (error) {
      next(error)
    }
  })

  router.get(
    '/me',
    loadAuthentication,
    requireAuthentication,
    (req, res) => {
      res.json({ user: req.auth.user })
    },
  )

  router.post('/logout', originGuard, async (req, res, next) => {
    try {
      await revokeSession(req.cookies?.[authConfig.cookieName])
      res.clearCookie(
        authConfig.cookieName,
        clearSessionCookieOptions(),
      )
      res.sendStatus(204)
    } catch (error) {
      next(error)
    }
  })

  router.post(
    '/logout-all',
    originGuard,
    loadAuthentication,
    requireAuthentication,
    async (req, res, next) => {
      try {
        await revokeAllUserSessions(req.auth.user.id)
        res.clearCookie(
          authConfig.cookieName,
          clearSessionCookieOptions(),
        )
        res.sendStatus(204)
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
