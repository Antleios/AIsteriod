import { authConfig } from '../config/auth.js'
import { getAuthenticatedSession } from '../services/authService.js'

export async function loadAuthentication(req, res, next) {
  void res

  try {
    req.auth = await getAuthenticatedSession(
      req.cookies?.[authConfig.cookieName],
    )
    next()
  } catch (error) {
    next(error)
  }
}

export function requireAuthentication(req, res, next) {
  if (!req.auth) {
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: '请先登录',
      },
    })
    return
  }

  next()
}

export function requireRole(...roles) {
  return function requireRoleMiddleware(req, res, next) {
    if (!req.auth) {
      requireAuthentication(req, res, next)
      return
    }

    if (!roles.includes(req.auth.user.role)) {
      res.status(403).json({
        error: {
          code: 'ROLE_REQUIRED',
          message: '当前账号没有执行此操作的权限',
        },
      })
      return
    }

    next()
  }
}
