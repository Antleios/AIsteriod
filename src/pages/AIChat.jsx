import { useNavigate } from 'react-router-dom'
import aiLogo from '../assets/logo.jpg'

function AIChat() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      {/* Top Bar */}
      <div className="flex items-center gap-4 px-6 py-5">
        <button
          onClick={() => navigate('/patient')}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-[#3B82F6]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-[#3B82F6]">AI 对话</h1>
        <div className="w-[88px]" />
      </div>

      {/* Placeholder content —— 具体功能等待后续说明 */}
      <main className="flex flex-col items-center justify-center px-6 pb-16 pt-10">
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white shadow-xl">
          <img src={aiLogo} alt="AI" className="h-full w-full object-cover" />
        </div>
        <p className="mt-6 text-base text-gray-500">
          AI 对话功能即将上线，敬请期待！
        </p>
      </main>
    </div>
  )
}

export default AIChat
