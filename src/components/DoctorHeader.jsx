import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCurrentUser, logout } from '../api/auth.js'
import brandLogo from '../assets/brand-logo.png'

/**
 * 医生端统一顶栏
 * - 左上角：医生端标识（可点击回到医生端首页）
 * - 右上角：当前登录用户状态 + 退出登录
 */
function DoctorHeader({ title = '医生端', toHome = '/doctor' }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  // 挂载时用后端会话恢复登录态
  useEffect(() => {
    let cancelled = false
    fetchCurrentUser().then((u) => {
      if (cancelled) return
      setUser(u)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="flex items-center justify-between px-6 py-5 md:px-12">
      {/* 左上角：医生端标识 */}
      <button
        onClick={() => navigate(toHome)}
        className="group flex items-center gap-2"
      >
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md shadow-[#3B82F6]/20 ring-1 ring-[#3B82F6]/10 transition-transform group-hover:scale-105">
          <img
            src={brandLogo}
            alt="Alsteroid"
            className="h-8 w-8 object-contain"
          />
        </span>
        <span className="text-2xl font-bold text-[#3B82F6]">{title}</span>
      </button>

      {/* 右上角：登录状态 */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 rounded-full bg-[#EAF4FF] px-5 py-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="max-w-[160px] truncate text-sm font-medium text-[#3B82F6]">
              {user.displayName || user.username}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#3B82F6]">
              {user.role === 'DOCTOR' ? '医生' : user.role}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
        >
          退出登录
        </button>
      </div>
    </header>
  )
}

export default DoctorHeader
