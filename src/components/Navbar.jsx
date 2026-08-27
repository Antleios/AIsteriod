import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../api/auth.js'

function Navbar() {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => getCurrentUser())

  const handleLogout = () => {
    logout()
    setUser(null)
    navigate('/')
  }

  return (
    <nav className="flex items-center justify-between px-12 py-6">
      {/* Left: Brand Name */}
      <span className="text-2xl font-bold text-[#3B82F6]">Alsteroid</span>

      {/* Right: Nav Links */}
      <div className="flex items-center gap-8">
        {user ? (
          <>
            {/* 已登录账号 */}
            <div className="flex items-center gap-2 rounded-full bg-[#EAF4FF] px-5 py-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="max-w-[160px] truncate text-sm font-medium text-[#3B82F6]">
                {user.account ?? user.phone}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
            >
              退出登录
            </button>
          </>
        ) : (
          <>
            <button className="rounded-full bg-[#EAF4FF] px-5 py-2 text-sm font-medium text-[#3B82F6] transition-all hover:bg-[#3B82F6] hover:text-white hover:shadow-lg">
              获取手机App
            </button>
            <button className="text-sm font-medium text-gray-600 transition-colors hover:text-[#3B82F6]">
              English
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar
