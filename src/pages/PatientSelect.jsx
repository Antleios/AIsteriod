import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCurrentUser, logout } from '../api/auth.js'
import {
  clearActiveTrainingSession,
  finishTrainingSession,
  getActiveTrainingSession,
} from '../api/training.js'

function PatientSelect() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [hasActiveTraining, setHasActiveTraining] = useState(false)
  const [finishingTraining, setFinishingTraining] = useState(false)
  const [trainingMessage, setTrainingMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchCurrentUser().then(async (currentUser) => {
      if (cancelled) return
      setUser(currentUser)
      if (!currentUser || currentUser.role !== 'PATIENT') {
        setHasActiveTraining(false)
        return
      }
      try {
        const activeTraining = await getActiveTrainingSession()
        if (!cancelled) setHasActiveTraining(Boolean(activeTraining))
      } catch {
        if (!cancelled) setHasActiveTraining(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    clearActiveTrainingSession()
    setUser(null)
    navigate('/')
  }

  const handleFinishTraining = async () => {
    if (!window.confirm('结束本次训练并生成医生摘要吗？结束后不能继续写入本次记录。')) return
    setFinishingTraining(true)
    setTrainingMessage('')
    try {
      await finishTrainingSession()
      setHasActiveTraining(false)
      setTrainingMessage('本次训练已保存，摘要已生成。')
    } catch (error) {
      setTrainingMessage(error.message || '结束训练失败，请稍后重试。')
    } finally {
      setFinishingTraining(false)
    }
  }

  const options = [
    {
      path: '/patient/games',
      emoji: '🎮',
      title: '训练游戏',
      desc: '三个趣味康复小游戏，边玩边训练',
      color: '#3B82F6',
    },
    {
      path: '/patient/ai-chat',
      emoji: '🤖',
      title: 'AI 对话',
      desc: '与 AI 助手实时对话，练习表达与社交',
      color: '#8B5CF6',
    },
  ]

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      {/* Top Bar */}
      <div className="flex items-center gap-4 px-6 py-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-[#3B82F6]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回首页
        </button>
        <h1 className="flex-1 text-center text-2xl font-bold text-[#3B82F6]">患者端</h1>
        <div className="flex w-[88px] items-center justify-end">
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-red-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              退出
            </button>
          )}
        </div>
      </div>

      {/* Choose an option */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16">
        <p className="mb-8 text-base tracking-widest text-gray-400">请选择要进行的活动</p>
        {hasActiveTraining && (
          <div className="mb-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleFinishTraining}
              disabled={finishingTraining}
              className="rounded-xl border border-[#3B82F6]/30 bg-white px-5 py-2 text-sm font-medium text-[#3B82F6] shadow-sm transition hover:bg-[#EAF4FF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {finishingTraining ? '正在保存训练记录…' : '结束本次训练并生成摘要'}
            </button>
            {trainingMessage && <p className="text-sm text-gray-500">{trainingMessage}</p>}
          </div>
        )}
        <div className="flex w-full flex-col gap-8 md:flex-row md:justify-center md:gap-12">
          {options.map((o) => (
            <button
              key={o.path}
              onClick={() => navigate(o.path)}
              className="group flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-white/40 bg-white/70 p-10 shadow-lg backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
            >
              {/* Icon */}
              <div
                className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-md transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${o.color}15` }}
              >
                {o.emoji}
              </div>

              {/* Text */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-[#1E3A5F]">{o.title}</h2>
                <p className="mt-2 text-base text-gray-500">{o.desc}</p>
              </div>

              {/* Arrow */}
              <span
                className="mt-2 rounded-full px-5 py-2 text-sm font-medium text-white transition-all duration-300 group-hover:shadow-lg"
                style={{ backgroundColor: o.color }}
              >
                开始
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

export default PatientSelect
