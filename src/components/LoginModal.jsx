import { useEffect, useState } from 'react'
import { loginWithPassword, register } from '../api/auth.js'

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/

/**
 * 登录卡片（类 B 站弹窗登录），患者端 / 医生端共用
 *
 * - 两种方式：密码登录 / 注册
 * - 密码登录页含「登录」主操作 +「注册」链接，点注册跳到注册界面
 * - 注册患者 / 医生账号成功即自动登录（后端写入会话 Cookie）
 * - 具体逻辑对接真实后端（src/api/auth.js → server/routes/auth.js）
 */
function LoginModal({ open, onClose, onSuccess, role = 'PATIENT' }) {
  const [tab, setTab] = useState('password') // 'password' | 'register'
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  // 注册字段
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isDoctor = role === 'DOCTOR'

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // 切换方式时清空错误提示
  useEffect(() => setError(''), [tab])

  if (!open) return null

  const validateRegister = () => {
    if (!USERNAME_RE.test(username.trim())) {
      return '用户名需 3-32 位，仅支持字母、数字、点、下划线和连字符'
    }
    if (!displayName.trim()) return '请输入昵称'
    if (displayName.trim().length > 50) return '昵称不能超过 50 个字符'
    if (newPassword.length < 10) return '密码至少需要 10 个字符'
    if (newPassword.length > 128) return '密码不能超过 128 个字符'
    if (newPassword !== confirmPassword) return '两次输入的密码不一致'
    return null
  }

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!account.trim()) {
      setError('请输入用户名')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
    setLoading(true)
    try {
      await loginWithPassword({ account: account.trim(), password })
      onSuccess?.()
    } catch (err) {
      setError(err.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    const message = validateRegister()
    if (message) {
      setError(message)
      return
    }
    setLoading(true)
    try {
      await register({
        username: username.trim().toLowerCase(),
        password: newPassword,
        displayName: displayName.trim(),
        role,
      })
      onSuccess?.()
    } catch (err) {
      setError(err.message || '注册失败，请重试')
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
        <h2 className="text-2xl font-bold text-[#1E3A5F]">{isDoctor ? '医生端' : '患者端'}</h2>
        <p className="mt-1 text-sm text-gray-400">
          {tab === 'password'
            ? isDoctor
              ? '登录医生账号，即可管理患者训练'
              : '登录后即可开始训练与 AI 对话'
            : isDoctor
              ? '注册医生账号，登录后即可使用'
              : '注册患者账号，登录后即可开始训练'}
        </p>

        {/* 登录 / 注册 切换 */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-[#EAF4FF] p-1">
          <button type="button" className={tabCls(tab === 'password')} onClick={() => setTab('password')}>
            密码登录
          </button>
          <button type="button" className={tabCls(tab === 'register')} onClick={() => setTab('register')}>
            注册
          </button>
        </div>

        {/* 密码登录 */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="mt-6 flex flex-col gap-4">
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="用户名"
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
              onClick={() => setTab('register')}
              className="text-center text-sm text-[#3B82F6] transition-colors hover:underline"
            >
              没有账号？点击注册 →
            </button>
          </form>
        )}

        {/* 注册 */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名（3-32 位，字母/数字/._-）"
              autoComplete="username"
              className={inputCls}
            />
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="昵称（1-50 个字符）"
              autoComplete="nickname"
              className={inputCls}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="密码（至少 10 位）"
              autoComplete="new-password"
              className={inputCls}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="确认密码"
              autoComplete="new-password"
              className={inputCls}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className={submitBtnCls}>
              {loading ? '注册中…' : '注 册'}
            </button>

            <p className="text-center text-xs text-gray-400">
              注册即创建{isDoctor ? '医生' : '患者'}账号，成功后自动登录
            </p>

            <button
              type="button"
              onClick={() => setTab('password')}
              className="text-center text-sm text-[#3B82F6] transition-colors hover:underline"
            >
              已有账号？返回登录 →
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default LoginModal
