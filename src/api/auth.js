// 预留登录接口 —— 当前全部为 mock 实现，用于前端先跑通完整登录流程。
// 后续接入真实后端：只需替换各函数函数体（参照 README「AI 接入指南」的接入思路），
// 登录弹窗与页面无需改动。

const AUTH_KEY = 'alsteroid_auth'

const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

/** 读取当前登录用户（localStorage 持久化），未登录返回 null */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** 是否已登录 */
export function isLoggedIn() {
  return Boolean(getCurrentUser())
}

/** 退出登录 */
export function logout() {
  localStorage.removeItem(AUTH_KEY)
}

/**
 * 发送短信验证码
 * TODO: 后端接入 —— POST /api/auth/sms-code { phone }
 * mock：合法手机号视为发送成功，验证码可填任意 6 位数字
 */
export async function sendSmsCode(phone) {
  await delay(600)
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new Error('请输入正确的手机号')
  }
  return { ok: true, message: `验证码已发送至 ${phone}` }
}

/**
 * 密码登录
 * TODO: 后端接入 —— POST /api/auth/login { account, password }
 * mock：账号密码非空即可登录（演示用）
 */
export async function loginWithPassword({ account, password }) {
  await delay(600)
  if (!account?.trim()) throw new Error('请输入账号')
  if (!password) throw new Error('请输入密码')
  const user = { account: account.trim(), loginMethod: 'password' }
  persistAuth(user)
  return user
}

/**
 * 短信登录 / 注册（未注册手机号验证后自动注册，即「直接注册/登录」）
 * TODO: 后端接入 —— POST /api/auth/sms-login { phone, code }
 * mock：手机号合法 + 6 位验证码即可
 */
export async function loginWithSms({ phone, code }) {
  await delay(600)
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请输入正确的手机号')
  if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位验证码')
  const user = { phone, loginMethod: 'sms' }
  persistAuth(user)
  return user
}

function persistAuth(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...user, ts: Date.now() }))
}
