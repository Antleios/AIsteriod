import { useNavigate } from 'react-router-dom'
import DoctorHeader from '../components/DoctorHeader.jsx'

function UsersIcon() {
  return (
    <svg
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
    </svg>
  )
}

// 数据概览 —— 前端 mock，后端接入后替换为真实统计接口
const stats = [
  { label: '患者总数', value: '128', unit: '人', color: '#3B82F6' },
  { label: '今日训练', value: '32', unit: '次', color: '#8B5CF6' },
  { label: '待评估', value: '5', unit: '人', color: '#EC4899' },
  { label: '训练完成率', value: '78', unit: '%', color: '#10B981' },
]

// 功能模块 —— 后端接入后各页面改为调用真实接口
const modules = [
  {
    path: '/doctor/users',
    title: '患者病历管理',
    desc: '查看患者病历档案与账号信息，统一管理',
    color: '#3B82F6',
    icon: <UsersIcon />,
  },
  {
    path: '/doctor/training',
    title: '训练数据',
    desc: '查看患者各训练游戏的表现与记录',
    color: '#8B5CF6',
    icon: <ChartIcon />,
  },
  {
    path: '/doctor/conversations',
    title: '对话数据',
    desc: '查看患者与 AI 的对话记录与情感分析',
    color: '#14B8A6',
    icon: <ChatIcon />,
  },
]

function Doctor() {
  const navigate = useNavigate()

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-6">
        {/* 欢迎语 */}
        <p className="text-base tracking-widest text-gray-400">患者数据管理控制台</p>
        <h1 className="mt-2 text-3xl font-bold text-[#1E3A5F]">欢迎使用医生端</h1>

        {/* 数据概览 */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-3xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur-sm"
            >
              <p className="text-sm text-gray-400">{s.label}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold" style={{ color: s.color }}>
                  {s.value}
                </span>
                <span className="text-sm text-gray-400">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 功能模块 */}
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {modules.map((m) => (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              className="group flex items-center gap-5 rounded-3xl border border-white/40 bg-white/70 p-7 text-left shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
            >
              <div
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl shadow-md transition-transform group-hover:scale-105"
                style={{ backgroundColor: `${m.color}15`, color: m.color }}
              >
                {m.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#1E3A5F]">{m.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{m.desc}</p>
              </div>
              <svg
                className="h-5 w-5 flex-shrink-0 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-[#3B82F6]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-300">
          当前为前端 mock 数据，后端接口接入中
        </p>
      </main>
    </div>
  )
}

export default Doctor
