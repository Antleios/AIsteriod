import { useState } from 'react'
import DoctorHeader from '../components/DoctorHeader.jsx'

// 训练数据 —— 当前为前端 mock 数据，后端接入后替换为真实接口
const records = [
  { id: 1, patient: '张小明', game: '物品命名', score: 85, accuracy: 85, duration: '12 分钟', time: '今天 09:20' },
  { id: 2, patient: '王小雅', game: '颜色连线', score: 92, accuracy: 92, duration: '8 分钟', time: '今天 10:05' },
  { id: 3, patient: '陈一诺', game: '物品命名', score: 71, accuracy: 71, duration: '15 分钟', time: '昨天 16:40' },
  { id: 4, patient: '刘子涵', game: '表情匹配', score: 88, accuracy: 88, duration: '10 分钟', time: '昨天 14:12' },
  { id: 5, patient: '李浩浩', game: '表情匹配', score: 78, accuracy: 78, duration: '9 分钟', time: '前天 11:30' },
  { id: 6, patient: '赵天佑', game: '颜色连线', score: 64, accuracy: 64, duration: '13 分钟', time: '前天 09:55' },
]

function accuracyColor(accuracy) {
  if (accuracy >= 85) return 'bg-emerald-500'
  if (accuracy >= 70) return 'bg-[#3B82F6]'
  return 'bg-orange-400'
}

function DoctorTraining() {
  const [keyword, setKeyword] = useState('')
  const filtered = records.filter(
    (r) => r.patient.includes(keyword.trim()) || r.game.includes(keyword.trim()),
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">训练数据</h1>
        <p className="mt-1 text-sm text-gray-400">
          共 {filtered.length} 条记录（前端 mock 数据，后端待接入）
        </p>

        {/* 搜索 */}
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/80 px-4 py-2.5 shadow-sm focus-within:border-[#3B82F6]/40 focus-within:ring-2 focus-within:ring-[#3B82F6]/15">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索患者或训练游戏…"
            className="flex-1 bg-transparent text-sm text-[#1E3A5F] outline-none placeholder:text-gray-400"
          />
        </div>

        {/* 训练记录表格 */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white/80 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F7FAFF] text-xs text-gray-400">
                <th className="px-5 py-3 font-medium">患者</th>
                <th className="px-5 py-3 font-medium">训练游戏</th>
                <th className="px-5 py-3 font-medium">得分</th>
                <th className="px-5 py-3 font-medium">正确率</th>
                <th className="px-5 py-3 font-medium">时长</th>
                <th className="px-5 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 transition-colors last:border-0 hover:bg-[#F7FAFF]/70"
                >
                  <td className="px-5 py-3 font-medium text-[#1E3A5F]">{r.patient}</td>
                  <td className="px-5 py-3 text-gray-500">{r.game}</td>
                  <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{r.score}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${accuracyColor(r.accuracy)}`}
                          style={{ width: `${r.accuracy}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{r.accuracy}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{r.duration}</td>
                  <td className="px-5 py-3 text-gray-500">{r.time}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    没有找到匹配的训练记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

export default DoctorTraining
