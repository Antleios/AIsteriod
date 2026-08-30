import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DoctorHeader from '../components/DoctorHeader.jsx'
import { fetchDoctorDashboard } from '../api/doctor.js'

function UsersIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  )
}

const modules = [
  {
    path: '/doctor/users',
    title: '患者病历管理',
    desc: '关联患者账号并维护患者档案',
    color: '#3B82F6',
    icon: <UsersIcon />,
  },
  {
    path: '/doctor/training',
    title: '训练数据',
    desc: '查看患者各训练游戏的实时表现',
    color: '#8B5CF6',
    icon: <ChartIcon />,
  },
  {
    path: '/doctor/conversations',
    title: '对话数据',
    desc: '查看患者与 AI 的完整对话记录',
    color: '#14B8A6',
    icon: <ChatIcon />,
  },
]

function Doctor() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchDoctorDashboard('7d')
      setDashboard(data.dashboard)
      setError('')
    } catch (requestError) {
      setError(requestError.message || '数据概览读取失败')
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    const timer = window.setInterval(loadDashboard, 15_000)
    return () => window.clearInterval(timer)
  }, [loadDashboard])

  const today = dashboard?.dailyTraining?.at(-1)
  const stats = [
    {
      label: '关联患者',
      value: dashboard?.stats.assignedPatientCount,
      unit: '人',
      color: '#3B82F6',
    },
    {
      label: '今日训练',
      value: today?.gameRunCount,
      unit: '次',
      color: '#8B5CF6',
    },
    {
      label: '近 7 日活跃',
      value: dashboard?.stats.activePatientCount,
      unit: '人',
      color: '#EC4899',
    },
    {
      label: '会话完成率',
      value: dashboard?.stats.sessionCompletionRate,
      unit: '%',
      color: '#10B981',
    },
  ]

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-6">
        <p className="text-base tracking-widest text-gray-400">患者数据管理控制台</p>
        <h1 className="mt-2 text-3xl font-bold text-[#1E3A5F]">欢迎使用医生端</h1>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur-sm"
            >
              <p className="text-sm text-gray-400">{stat.label}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold" style={{ color: stat.color }}>
                  {stat.value ?? '--'}
                </span>
                <span className="text-sm text-gray-400">{stat.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {modules.map((module) => (
            <button
              key={module.path}
              onClick={() => navigate(module.path)}
              className="group flex items-center gap-5 rounded-3xl border border-white/40 bg-white/70 p-7 text-left shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
            >
              <div
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl shadow-md transition-transform group-hover:scale-105"
                style={{ backgroundColor: `${module.color}15`, color: module.color }}
              >
                {module.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#1E3A5F]">{module.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{module.desc}</p>
              </div>
              <span className="text-xl text-gray-300 transition-transform group-hover:translate-x-1">
                ›
              </span>
            </button>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-300">数据每 15 秒自动更新</p>
      </main>
    </div>
  )
}

export default Doctor
