const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function createOriginGuard(allowedOrigins) {
  const allowed = new Set(allowedOrigins)

  return function originGuard(req, res, next) {
    const origin = req.get('origin')

    if (
      !UNSAFE_METHODS.has(req.method) ||
      !origin ||
      allowed.has(origin)
    ) {
      next()
      return
    }

    res.status(403).json({
      error: {
        code: 'ORIGIN_NOT_ALLOWED',
        message: '请求来源不被允许',
      },
    })
  }
}
