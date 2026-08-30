import { useCallback, useEffect, useRef, useState } from 'react'
import DoctorHeader from '../components/DoctorHeader.jsx'
import { fetchDoctorTrainingRecords } from '../api/doctor.js'

function accuracyColor(accuracy) {
  if (accuracy >= 85) return 'bg-emerald-500'
  if (accuracy >= 70) return 'bg-[#3B82F6]'
  return 'bg-orange-400'
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return '--'
  if (durationMs < 60_000) return `${Math.max(1, Math.round(durationMs / 1_000))} 秒`
  return `${Math.round(durationMs / 60_000)} 分钟`
}

function formatTime(value) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status) {
  if (status === 'COMPLETED') return '已完成'
  if (status === 'ACTIVE') return '训练中'
  return '已结束'
}

function DoctorTraining() {
  const [keyword, setKeyword] = useState('')
  const [records, setRecords] = useState([])
  const [page, setPage] = useState({ nextCursor: null })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)

  const loadFirstPage = useCallback(async (query, quiet = false) => {
    const requestId = ++requestRef.current
    if (!quiet) setLoading(true)
    try {
      const data = await fetchDoctorTrainingRecords({ q: query || undefined })
      if (requestId !== requestRef.current) return
      setRecords(data.records)
      setPage(data.page)
      setError('')
    } catch (requestError) {
      if (requestId === requestRef.current) {
        setError(requestError.message || '训练数据读取失败')
      }
    } finally {
      if (requestId === requestRef.current && !quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => loadFirstPage(keyword.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [keyword, loadFirstPage])

  useEffect(() => {
    const timer = window.setInterval(() => loadFirstPage(keyword.trim(), true), 15_000)
    return () => window.clearInterval(timer)
  }, [keyword, loadFirstPage])

  const loadMore = async () => {
    if (!page.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchDoctorTrainingRecords({
        cursor: page.nextCursor,
        q: keyword.trim() || undefined,
      })
      setRecords((current) => [...current, ...data.records])
      setPage(data.page)
      setError('')
    } catch (requestError) {
      setError(requestError.message || '更多训练数据读取失败')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">训练数据</h1>
        <p className="mt-1 text-sm text-gray-400">患者答题后自动写入，页面每 15 秒更新</p>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/80 px-4 py-2.5 shadow-sm">
          <span className="text-gray-400">⌕</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索患者姓名或训练游戏…"
            className="flex-1 bg-transparent text-sm text-[#1E3A5F] outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-100 bg-white/80 shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F7FAFF] text-xs text-gray-400">
                <th className="px-5 py-3 font-medium">患者</th>
                <th className="px-5 py-3 font-medium">训练游戏</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">正确率</th>
                <th className="px-5 py-3 font-medium">正确/作答</th>
                <th className="px-5 py-3 font-medium">时长</th>
                <th className="px-5 py-3 font-medium">开始时间</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const accuracy = record.accuracy
                return (
                  <tr
                    key={record.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-[#F7FAFF]/70"
                  >
                    <td className="px-5 py-3 font-medium text-[#1E3A5F]">
                      {record.patient.displayName}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{record.gameTitle}</td>
                    <td className="px-5 py-3 text-gray-500">{statusLabel(record.status)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${accuracyColor(accuracy ?? 0)}`}
                            style={{ width: `${accuracy ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {accuracy == null ? '--' : `${accuracy}%`}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {record.correctCount}/{record.totalAttempts}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {formatDuration(record.durationMs)}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatTime(record.startedAt)}</td>
                  </tr>
                )
              })}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    暂无训练记录
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    正在读取训练记录…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {page.nextCursor && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mx-auto mt-5 rounded-full bg-white px-5 py-2 text-sm text-[#3B82F6] shadow-sm disabled:opacity-50"
          >
            {loadingMore ? '读取中…' : '加载更多'}
          </button>
        )}
      </main>
    </div>
  )
}

export default DoctorTraining
