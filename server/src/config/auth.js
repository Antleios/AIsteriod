const DEFAULT_SESSION_TTL_DAYS = 7
const DEFAULT_LOGIN_WINDOW_MINUTES = 15
const DEFAULT_LOGIN_MAX_ATTEMPTS = 10

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const USER_ROLES = ['PATIENT', 'DOCTOR', 'ADMIN']
export const USER_STATUSES = ['ACTIVE', 'DISABLED']

export const authConfig = {
  sessionTtlMs:
    positiveInteger(
      process.env.AUTH_SESSION_TTL_DAYS,
      DEFAULT_SESSION_TTL_DAYS,
    ) *
    24 *
    60 *
    60 *
    1000,
  loginWindowMs:
    positiveInteger(
      process.env.AUTH_LOGIN_WINDOW_MINUTES,
      DEFAULT_LOGIN_WINDOW_MINUTES,
    ) *
    60 *
    1000,
  loginMaxAttempts: positiveInteger(
    process.env.AUTH_LOGIN_MAX_ATTEMPTS,
    DEFAULT_LOGIN_MAX_ATTEMPTS,
  ),
  cookieName:
    process.env.NODE_ENV === 'production'
      ? '__Host-aisteriod_session'
      : 'aisteriod_session',
  cookieSecure: process.env.NODE_ENV === 'production',
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: authConfig.cookieSecure,
    path: '/',
    maxAge: authConfig.sessionTtlMs,
  }
}

export function clearSessionCookieOptions() {
  const { maxAge, ...options } = sessionCookieOptions()
  void maxAge
  return options
}
