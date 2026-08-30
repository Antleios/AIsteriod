import { useCallback, useEffect, useRef, useState } from 'react'
import DoctorHeader from '../components/DoctorHeader.jsx'
import {
  fetchDoctorConversation,
  fetchDoctorConversations,
} from '../api/doctor.js'

const statusStyle = {
  ACTIVE: 'bg-emerald-50 text-emerald-600',
  COMPLETED: 'bg-[#EAF4FF] text-[#3B82F6]',
  FINALIZING: 'bg-amber-50 text-amber-600',
}

const statusText = {
  ACTIVE: '进行中',
  COMPLETED: '已结束',
  FINALIZING: '生成摘要中',
}

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return '—'
  const minutes = Math.floor(durationMs / 60_000)
  if (minutes < 1) return '不足 1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

function conversationTopic(record) {
  return record.contexts?.map((context) => context.title).join('、') || 'AI 对话'
}

function conversationSummary(record) {
  if (record.summary?.interactionSummary) return record.summary.interactionSummary
  if (record.status === 'ACTIVE') return '会话进行中，完整消息正在同步。'
  if (record.summaryStatus === 'FAILED') return '会话已保存，摘要生成失败。'
  return '完整会话已保存，暂无分析摘要。'
}

function ConversationModal({ record, loading, error, onClose }) {
  const turns = record?.turns ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 animate-fade-in bg-[#1E3A5F]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[86vh] w-full max-w-2xl animate-modal-pop flex-col rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 md:px-8">
          <div>
            <h2 className="text-xl font-bold text-[#1E3A5F]">
              {record?.patient.displayName ?? '患者'} · 完整对话记录
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {record ? conversationTopic(record) : '正在读取'} · {formatTime(record?.lastMessageAt)} ·
              共 {record?.turnCount ?? 0} 条消息
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#F7FAFF] px-6 py-6 md:px-8">
          {loading && turns.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">正在读取完整对话…</p>
          )}
          {error && turns.length === 0 && (
            <p className="py-12 text-center text-sm text-red-500">{error}</p>
          )}
          {turns.map((turn) => {
            const isUser = turn.role === 'USER'
            return (
              <div key={turn.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <span className={`mb-1 px-1 text-xs ${isUser ? 'text-[#3B82F6]' : 'text-gray-400'}`}>
                  {isUser ? '患者' : 'AI 助手'} · {turn.contextTitle} · {formatTime(turn.createdAt)}
                  {turn.inputMethod === 'ASR' ? ' · 语音输入' : ''}
                </span>
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-tr-sm bg-gradient-to-r from-[#3B82F6] to-[#5EA2FF] text-white shadow-md shadow-[#3B82F6]/20'
                      : 'rounded-tl-sm border border-gray-100 bg-white text-[#1E3A5F] shadow-sm'
                  }`}
                >
                  {turn.content}
                </div>
                {!isUser && turn.ai && (
                  <span className="mt-1 px-1 text-[11px] text-gray-400">
                    {turn.ai.provider || 'AI'}
                    {turn.ai.model ? ` / ${turn.ai.model}` : ''}
                    {turn.responseLatencyMs !== null ? ` · ${turn.responseLatencyMs} ms` : ''}
                  </span>
                )}
              </div>
            )
          })}
          {!loading && !error && turns.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">该会话暂无消息。</p>
          )}
        </div>

        <div className="border-t border-gray-100 px-8 py-3 text-center text-xs text-gray-400">
          完整正文仅向与患者存在有效关联的医生开放
          {record?.status === 'ACTIVE' ? '，进行中的对话每 5 秒刷新' : ''}
        </div>
      </div>
    </div>
  )
}

function DoctorConversations() {
  const [keyword, setKeyword] = useState('')
  const [records, setRecords] = useState([])
  const [page, setPage] = useState({ total: 0, nextCursor: null })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [openSummary, setOpenSummary] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)

  const loadFirstPage = useCallback(async (query, quiet = false) => {
    const requestId = ++listRequestRef.current
    if (!quiet) setLoading(true)
    try {
      const data = await fetchDoctorConversations({ q: query || undefined })
      if (requestId !== listRequestRef.current) return
      setRecords(data.conversations)
      setPage(data.page)
      setError('')
    } catch (requestError) {
      if (requestId !== listRequestRef.current) return
      setError(requestError.message || '对话记录读取失败')
    } finally {
      if (requestId === listRequestRef.current && !quiet) setLoading(false)
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
      const data = await fetchDoctorConversations({
        cursor: page.nextCursor,
        q: keyword.trim() || undefined,
      })
      setRecords((current) => [...current, ...data.conversations])
      setPage(data.page)
      setError('')
    } catch (requestError) {
      setError(requestError.message || '更多对话记录读取失败')
    } finally {
      setLoadingMore(false)
    }
  }

  const loadDetail = useCallback(async (sessionId, quiet = false) => {
    const requestId = ++detailRequestRef.current
    if (!quiet) setDetailLoading(true)
    try {
      const data = await fetchDoctorConversation(sessionId)
      if (requestId !== detailRequestRef.current) return
      setDetail(data.conversation)
      setDetailError('')
    } catch (requestError) {
      if (requestId !== detailRequestRef.current) return
      setDetailError(requestError.message || '完整对话读取失败')
    } finally {
      if (requestId === detailRequestRef.current && !quiet) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!openSummary) return undefined
    loadDetail(openSummary.id)
    const timer = window.setInterval(() => loadDetail(openSummary.id, true), 5_000)
    return () => window.clearInterval(timer)
  }, [openSummary, loadDetail])

  const openConversation = (record) => {
    setOpenSummary(record)
    setDetail(null)
    setDetailError('')
  }

  const closeConversation = () => {
    detailRequestRef.current += 1
    setOpenSummary(null)
    setDetail(null)
    setDetailLoading(false)
    setDetailError('')
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      <DoctorHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16 pt-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">对话数据</h1>
        <p className="mt-1 text-sm text-gray-400">
          共 {page.total} 个会话，患者与 AI 的完整消息由后端保存并定时更新
        </p>

        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white/80 px-4 py-2.5 shadow-sm focus-within:border-[#3B82F6]/40 focus-within:ring-2 focus-within:ring-[#3B82F6]/15">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索患者或对话内容…"
            className="flex-1 bg-transparent text-sm text-[#1E3A5F] outline-none placeholder:text-gray-400"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-100 bg-white/80 shadow-sm">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F7FAFF] text-xs text-gray-400">
                <th className="px-5 py-3 font-medium">患者</th>
                <th className="px-5 py-3 font-medium">最近消息</th>
                <th className="px-5 py-3 font-medium">对话场景</th>
                <th className="px-5 py-3 font-medium">消息数</th>
                <th className="px-5 py-3 font-medium">时长</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">分析摘要</th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-gray-50 transition-colors last:border-0 hover:bg-[#F7FAFF]/70">
                  <td className="px-5 py-3 font-medium text-[#1E3A5F]">{record.patient.displayName}</td>
                  <td className="px-5 py-3 text-gray-500">{formatTime(record.lastMessageAt)}</td>
                  <td className="px-5 py-3 text-gray-500">{conversationTopic(record)}</td>
                  <td className="px-5 py-3 text-gray-500">{record.turnCount}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDuration(record.durationMs)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle[record.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusText[record.status] ?? record.status}
                    </span>
                  </td>
                  <td className="max-w-[240px] px-5 py-3">
                    <p className="truncate text-gray-500" title={conversationSummary(record)}>
                      {conversationSummary(record)}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openConversation(record)}
                      className="rounded-full bg-[#EAF4FF] px-3 py-1 text-xs font-medium text-[#3B82F6] transition-colors hover:bg-[#dbeafe]"
                    >
                      查看完整对话
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    没有找到可查看的对话记录
                  </td>
                </tr>
              )}
              {loading && records.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    正在同步对话记录…
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
            className="mx-auto mt-5 rounded-full bg-white px-5 py-2 text-sm font-medium text-[#3B82F6] shadow-sm disabled:opacity-60"
          >
            {loadingMore ? '正在加载…' : '加载更多'}
          </button>
        )}
      </main>

      {openSummary && (
        <ConversationModal
          record={detail ?? openSummary}
          loading={detailLoading}
          error={detailError}
          onClose={closeConversation}
        />
      )}
    </div>
  )
}

export default DoctorConversations
