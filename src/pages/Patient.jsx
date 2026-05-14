import { useNavigate } from 'react-router-dom'

const games = [
  {
    path: '/object-game',
    emoji: '🍎',
    title: '物品命名游戏',
    desc: '看图片说出物品名称，锻炼认知与语言能力',
    color: '#3B82F6',
  },
  {
    path: '/color-game',
    emoji: '🎨',
    title: '颜色连线游戏',
    desc: '拖拽彩色物品到同色目标上，训练颜色辨识',
    color: '#8B5CF6',
  },
  {
    path: '/emoji-game',
    emoji: '😊',
    title: '表情匹配游戏',
    desc: '选出与情绪词匹配的表情，提升情绪识别能力',
    color: '#EC4899',
  },
]

function Patient() {
  const navigate = useNavigate()

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

      {/* Cards */}
      <main className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 pb-16 pt-6">
        {games.map((g) => (
          <button
            key={g.path}
            onClick={() => navigate(g.path)}
            className="group w-full rounded-3xl border border-white/40 bg-white/70 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-center gap-5">
              {/* Emoji icon */}
              <div
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl text-3xl shadow-md"
                style={{ backgroundColor: `${g.color}15` }}
              >
                {g.emoji}
              </div>

              {/* Text */}
              <div className="flex-1 text-left">
                <h2 className="text-xl font-bold text-[#1E3A5F]">{g.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{g.desc}</p>
              </div>

              {/* Arrow */}
              <svg
                className="h-6 w-6 flex-shrink-0 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-[#3B82F6]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </main>
    </div>
  )
}

export default Patient
