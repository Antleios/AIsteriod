import { useNavigate } from 'react-router-dom'

function PatientSelect() {
  const navigate = useNavigate()

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
    <div className="relative min-h-screen bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
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
        <h1 className="flex-1 text-center text-lg font-bold text-[#3B82F6]">患者端</h1>
        <div className="w-[88px]" />
      </div>

      {/* Choose an option */}
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-8">
        <p className="mb-8 text-sm tracking-widest text-gray-400">请选择要进行的活动</p>
        <div className="flex w-full flex-col gap-8 md:flex-row md:justify-center md:gap-12">
          {options.map((o) => (
            <button
              key={o.path}
              onClick={() => navigate(o.path)}
              className="group flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-white/40 bg-white/70 p-10 shadow-lg backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
            >
              {/* Icon */}
              <div
                className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-md transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${o.color}15` }}
              >
                {o.emoji}
              </div>

              {/* Text */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[#1E3A5F]">{o.title}</h2>
                <p className="mt-2 text-sm text-gray-500">{o.desc}</p>
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
