import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { requestSessionAiReply } from '../api/training.js'
import { cancelSpeech } from '../api/speech.js'
import { useGentleSpeech, useSpeechStatus } from '../hooks/useGentleSpeech.js'

const GameConversation = forwardRef(function GameConversation({ gameRunId, questionId, context, onBeforeListen, onActivity }, ref) {
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [provider, setProvider] = useState('')
  const requestRef = useRef(false)
  const askRef = useRef(null)
  const alive = useRef(true)
  const historyRef = useRef(null)
  const speak = useGentleSpeech()
  const speechStatus = useSpeechStatus()

  const ask = async (text, inputMethod = 'TEXT', trigger = 'USER_MESSAGE', targetQuestionId = questionId) => {
    const content = text?.trim()
    if ((!content && trigger === 'USER_MESSAGE') || requestRef.current) return false
    if (!gameRunId) { setError('请使用患者账号登录并开始训练，才能向小星提问。'); return false }
    requestRef.current = true
    setBusy(true)
    setError('')
    onBeforeListen?.()
    if (trigger !== 'USER_MESSAGE') window.dispatchEvent(new Event('game-proactive-reply'))
    cancelSpeech()
    if (content) setMessages((items) => [...items, { role: 'user', content }])
    try {
      const interaction = await requestSessionAiReply({ userText: content || undefined, inputMethod, context, gameRunId, questionId: targetQuestionId, trigger })
      if (!interaction?.reply) throw new Error('请先登录患者账号')
      if (!alive.current) return
      setMessages((items) => [...items, { role: 'assistant', content: interaction.reply }])
      setProvider(interaction.provider)
      speak(interaction.reply)
      return true
    } catch (failure) {
      if (alive.current) setError(failure.message || '小星暂时无法回复，输入已保留。')
      return false
    } finally {
      requestRef.current = false
      if (alive.current) setBusy(false)
    }
  }
  useEffect(() => { askRef.current = ask })
  useEffect(() => {
    const history = historyRef.current
    if (history) history.scrollTop = history.scrollHeight
  }, [messages, busy])
  useEffect(() => {
    onActivity?.(busy)
    return () => onActivity?.(false)
  }, [busy, onActivity])
  useImperativeHandle(ref, () => ({
    ask: (text, method) => askRef.current(text, method),
    nudge: (trigger, targetQuestionId) => askRef.current(undefined, 'TEXT', trigger, targetQuestionId),
    record: (role, content) => {
      if (content?.trim()) setMessages((items) => [...items, { role, content }])
    },
  }), [])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  return (
    <section className="my-8 w-full max-w-2xl rounded-3xl border border-blue-100 bg-white/90 p-5 shadow-sm" aria-label="游戏对话记录">
      <p className="font-semibold text-[#1E3A5F]">和小星的对话记录</p>
      <p className="mt-1 text-xs text-gray-500">这里保留本次游戏中的题目提示、作答、判定反馈和与小星的对话。</p>
      <div ref={historyRef} className="my-3 max-h-64 space-y-2 overflow-y-auto" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && <p className="py-4 text-center text-sm text-gray-400">还没有对话，想要提示或觉得困难都可以告诉小星。</p>}
        {messages.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.role === 'user' ? 'rounded-br-sm bg-blue-500 text-white' : 'rounded-bl-sm bg-blue-50 text-gray-700'}`}>
            <p className={`mb-1 text-xs ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>{message.role === 'user' ? '你' : '小星'}</p>
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        </div>)}
        {busy && <p className="text-sm text-gray-500">小星正在想怎么回答你…</p>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-orange-700">{error}</p>}
      {provider === 'deterministic' && <p className="mt-2 text-xs text-orange-700">当前是离线演示回复，请配置后端 Qwen API。</p>}
      {speechStatus && <p className="mt-2 text-xs text-gray-400">{speechStatus}</p>}
    </section>
  )
})

export default GameConversation
