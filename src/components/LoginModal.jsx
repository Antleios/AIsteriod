import { useEffect, useState } from 'react'
import * as auth from '../api/auth.js'

/**
 * 患者端登录卡片（类 B 站弹窗登录）
 *
 * - 两种登录方式：密码登录 / 短信登录
 * - 密码登录页含「登录」主操作 +「注册」链接，点注册跳转到短信登录界面
 * - 短信登录未注册手机号验证后自动注册，可直接登录/注册
 * - 具体逻辑由 src/api/auth.js 提供（当前为 mock，后续接后端）
 */
function LoginModal({ open, onClose, onSuccess }) {
  const [tab, setTab] = useState('password') // 'password' | 'sms'
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // 验证码倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // 切换登录方式时清空错误提示
  useEffect(() => setError(''), [tab])

  if (!open) return null

  const handleSendCode = async () => {
    setError('')
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号')
      return
    }
    await auth.sendSmsCode(phone)
    setCountdown(60)
  }

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.loginWithPassword({ account, password })
      onSuccess?.()
    } catch (err) {
      setError(err.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleSmsLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.loginWithSms({ phone, code })
      onSuccess?.()
    } catch (err) {
      setError(err.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-[#1E3A5F] outline-none transition-all placeholder:text-gray-400 focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20'

  const tabCls = (active) =>
    `rounded-full py-2 text-sm font-medium transition-all ${
      active ? 'bg-white text-[#3B82F6] shadow' : 'text-gray-400 hover:text-[#3B82F6]/70'
    }`

  const submitBtnCls =
    'rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#5EA2FF] py-3 text-sm font-semibold text-white shadow-lg shadow-[#3B82F6]/30 transition-all hover:shadow-xl hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 animate-fade-in bg-[#1E3A5F]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 登录卡片 */}
      <div className="relative w-full max-w-[400px] animate-modal-pop rounded-3xl bg-white p-8 shadow-2xl">
        {/* 关闭 */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="关闭"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 标题 */}
        <h2 className="text-2xl font-bold text-[#1E3A5F]">患者端登录</h2>
        <p className="mt-1 text-sm text-gray-400">登录后即可开始训练与 AI 对话</p>

        {/* 登录方式切换 */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-[#EAF4FF] p-1">
          <button type="button" className={tabCls(tab === 'password')} onClick={() => setTab('password')}>
            密码登录
          </button>
          <button type="button" className={tabCls(tab === 'sms')} onClick={() => setTab('sms')}>
            短信登录
          </button>
        </div>

        {/* 密码登录：可登录，也可点注册跳到短信登录界面 */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="mt-6 flex flex-col gap-4">
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="账号 / 手机号"
              autoComplete="username"
              className={inputCls}
            />

            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete="current-password"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#3B82F6]"
                aria-label={showPwd ? '隐藏密码' : '显示密码'}
              >
                {showPwd ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className={submitBtnCls}>
              {loading ? '登录中…' : '登 录'}
            </button>

            <button
              type="button"
              onClick={() => setTab('sms')}
              className="text-center text-sm text-[#3B82F6] transition-colors hover:underline"
            >
              没有账号？点击注册，短信快捷登录 →
            </button>
          </form>
        )}

        {/* 短信登录：未注册手机号验证后自动注册，可直接登录/注册 */}
        {tab === 'sms' && (
          <form onSubmit={handleSmsLogin} className="mt-6 flex flex-col gap-4">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号"
              autoComplete="tel"
              maxLength={11}
              className={inputCls}
            />

            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6 位验证码"
                autoComplete="one-time-code"
                maxLength={6}
                className={inputCls}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={countdown > 0}
                className="w-[112px] flex-shrink-0 rounded-xl border border-[#3B82F6]/30 bg-[#EAF4FF] text-sm font-medium text-[#3B82F6] transition-all hover:bg-[#3B82F6] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
              </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className={submitBtnCls}>
              {loading ? '登录中…' : '登录 / 注册'}
            </button>

            <p className="text-center text-xs text-gray-400">
              未注册的手机号验证后将自动注册，无需额外填写
            </p>

            <button
              type="button"
              onClick={() => setTab('password')}
              className="text-center text-sm text-[#3B82F6] transition-colors hover:underline"
            >
              使用密码登录 →
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default LoginModal
