// 登录接口 —— 对接真实后端（server/src/routes/auth.js）
//
// 鉴权方式：服务端 Session + HttpOnly Cookie（开发环境 cookie 名为 aisteriod_session）。
// 前端所有请求必须携带 credentials: 'include'，否则拿不到/发不出会话 Cookie。
// 后端接口文档见 server/AUTH_API.md。

import { getApiUrl } from './client.js'

const BASE = getApiUrl('/api/auth')

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })

  if (!res.ok) {
    throw new Error(await readApiError(res))
  }

  return res.status === 204 ? null : res.json()
}

async function readApiError(res) {
  try {
    const data = await res.json()
    if (data?.error?.message) return data.error.message
    if (Array.isArray(data?.error?.details)) {
      return data.error.details.map((d) => d.message).join('；')
    }
  } catch {
    // 响应体不是 JSON，走兜底文案
  }
  return `请求失败 (${res.status})`
}

/** 密码登录 → POST /api/auth/login，成功后写入会话 Cookie */
export async function loginWithPassword({ account, password }) {
  const data = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ username: account, password }),
  })
  return data.user
}

/** 注册 → POST /api/auth/register（患者成功即自动登录，后端已写入会话 Cookie） */
export async function register({
  username,
  password,
  displayName,
  role = 'PATIENT',
}) {
  const data = await request('/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName, role }),
  })
  return data.user
}

/** 恢复登录态 → GET /api/auth/me；未登录或后端不可用返回 null */
export async function fetchCurrentUser() {
  try {
    const data = await request('/me')
    return data.user
  } catch {
    return null
  }
}

/** 退出登录 → POST /api/auth/logout（服务端撤销会话并清除 Cookie） */
export async function logout() {
  try {
    await request('/logout', { method: 'POST' })
  } catch {
    // 网络异常时忽略，本地登录态同样视为已退出
  }
}
