import SpeechControls from '../components/SpeechControls.jsx'
import { useGentleSpeech, useSpeechStatus } from '../hooks/useGentleSpeech.js'
import { cancelSpeech } from '../api/speech.js'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AiMascot from '../components/AiMascot.jsx'
import { requestAIMessage } from '../api/ai.js'
import { createVoiceInput } from '../api/voiceInput.js'

function AIChat() {
  const navigate = useNavigate()

  const [conversation, setConversation] = useState([]) // [{ role, content }]，真实 AI 接入时即完整对话历史
  const [transcript, setTranscript] = useState('') // 实时转写，停止后保留为可编辑草稿
  const [mascotExpression, setMascotExpression] = useState('calm') // calm | loving
  const [voiceStatus, setVoiceStatus] = useState('idle')
  const listening = voiceStatus !== 'idle'
  const [sending, setSending] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [chatReady, setChatReady] = useState(false)
  const [provider, setProvider] = useState('')
  const speechStatus = useSpeechStatus()

  const handlingRef = useRef(false) // 等待 AI 回复期间锁住，禁止连续发送
  const loveTimeoutRef = useRef(null) // 「喜欢」表情的计时器
  const recognitionRef = useRef(null)
  const voiceStatusRef = useRef('idle')
  const sendMessageRef = useRef(null)
  const inputMethodRef = useRef('TEXT')
  const chatEndRef = useRef(null)
  const aliveRef = useRef(true)
  const greetingIdRef = useRef(null)

  const speak = useGentleSpeech()

  // 显示「喜欢」表情（头顶冒小爱心），4 秒后恢复平静
  const showLoving = useCallback(() => {
    setMascotExpression('loving')
    if (loveTimeoutRef.current) clearTimeout(loveTimeoutRef.current)
    loveTimeoutRef.current = setTimeout(() => setMascotExpression('calm'), 4000)
  }, [])

  const sendMessage = useCallback(
    async (raw, inputMethod = 'TEXT') => {
      const content = (raw ?? '').trim()
      if (!content || handlingRef.current || voiceStatusRef.current !== 'idle') return
      handlingRef.current = true
      setSending(true)
      setVoiceError('')

      const userMsg = { role: 'user', content }
      const nextMessages = [...conversation, userMsg]
      setConversation(nextMessages)

      try {
        const { reply, emotion, provider: replyProvider } = await requestAIMessage(nextMessages, { inputMethod })
        if (!aliveRef.current) return
        setProvider(replyProvider)
        setConversation((prev) => [...prev, { role: 'assistant', content: reply }])
        setTranscript('')
        inputMethodRef.current = 'TEXT'
        if (emotion === 'celebrating') {
          showLoving()
        } else {
          setMascotExpression('calm')
        }
        speak(reply)
      } catch (error) {
        if (!aliveRef.current) return
        setMascotExpression('calm')
        setVoiceError(`${error.message || '发送或 AI 回复失败'}，输入内容已保留。`)
      } finally {
        handlingRef.current = false
        setSending(false)
      }
    },
    [conversation, speak, showLoving],
  )

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // 开场白也由会话接口生成和保存，确保医生端看到的记录与患者端一致。
  useEffect(() => {
    let cancelled = false
    handlingRef.current = true
    greetingIdRef.current ??= `greeting-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`
    requestAIMessage([], {
      trigger: 'CHAT_START',
      clientRequestId: greetingIdRef.current,
    })
      .then(({ reply, provider: replyProvider }) => {
        if (cancelled) return
        setConversation([{ role: 'assistant', content: reply }])
        setChatReady(true)
        setProvider(replyProvider)
        setVoiceError('')
        handlingRef.current = false
        speak(reply)
      })
      .catch((error) => {
        if (cancelled) return
        handlingRef.current = false
        setVoiceError(error.message || 'AI 对话初始化失败，请稍后重试')
      })
    return () => {
      cancelled = true
    }
  }, [speak])

  // 新消息自动滚到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceError('当前浏览器不支持语音识别，可以直接输入文字，或使用支持语音识别的 Chrome / Edge。')
      return
    }
    if (!window.isSecureContext) {
      setVoiceError('麦克风需要安全连接，请使用 HTTPS 或 localhost 打开页面。')
      return
    }
    // 停掉 AI 正在播报的语音，防止被麦克风拾音进去
    cancelSpeech()
    setVoiceError('')
    recognitionRef.current?.dispose()
    inputMethodRef.current = 'ASR'
    recognitionRef.current = createVoiceInput({
      Recognition: SpeechRecognition,
      initialText: transcript,
      onText: setTranscript,
      onStatus: (status) => {
        voiceStatusRef.current = status
        setVoiceStatus(status)
      },
      onError: setVoiceError,
      onAutoSend: (text) => sendMessageRef.current?.(text, inputMethodRef.current),
    })
    recognitionRef.current.start()
  }, [transcript])

  const toggleListening = useCallback(() => {
    if (!chatReady || handlingRef.current) return
    if (listening) {
      stopListening()
    } else {
      startListening()
    }
  }, [chatReady, listening, stopListening, startListening])

  // 卸载时清理
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (loveTimeoutRef.current) clearTimeout(loveTimeoutRef.current)
      recognitionRef.current?.dispose()
      cancelSpeech()
    }
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
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
        <h1 className="flex-1 text-center text-2xl font-bold text-[#3B82F6]">AI 对话</h1>
        <div className="w-[88px]" />
      </div>

      <SpeechControls />
      {/* 对话气泡（上方）：右侧用户，左侧 AI */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 py-4">
          {conversation.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-base leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-[#3B82F6] text-white'
                    : 'rounded-bl-md bg-white text-gray-700'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* 吉祥物（放下面一点）：黄色圆脸，眼睛跟随鼠标，听到喜欢的话会冒小爱心 */}
      <div className="flex justify-center pt-1 pb-1">
        <AiMascot expression={mascotExpression} listening={listening} size={170} />
      </div>

      {/* 停顿两秒自动发送；手动停止保留草稿。 */}
      <div className="border-t border-white/50 bg-white/60 px-4 py-4 backdrop-blur-sm">
        {provider === 'deterministic' && <p className="pb-2 text-center text-xs text-orange-700">当前为离线演示回复，请配置后端 Qwen API。</p>}
        {speechStatus && <p className="pb-2 text-center text-xs text-gray-400">{speechStatus}</p>}
        <div className="mx-auto max-w-2xl pb-3">
          <p role="status" className="pb-2 text-center text-sm font-medium text-[#3B82F6]">
            {voiceStatus === 'starting' ? '正在启动麦克风，请允许浏览器使用麦克风…'
              : voiceStatus === 'stopping' ? '正在结束录音，保留识别文字…'
                : voiceStatus === 'waiting' ? '已识别，停顿满 2 秒后自动发送…'
                  : listening ? '🎤 正在实时识别，停顿 2 秒自动发送；点击麦克风可停止并保留文字'
                    : '点击麦克风说话，停顿 2 秒自动发送；也可以输入文字'}
          </p>
          <textarea
            aria-label="消息内容"
            value={transcript}
            onChange={(event) => {
              setTranscript(event.target.value)
              inputMethodRef.current = 'TEXT'
            }}
            readOnly={listening || sending}
            placeholder="识别的文字会显示在这里，也可以直接输入…"
            rows={3}
            className="w-full resize-none rounded-xl border border-blue-100 bg-white px-4 py-3 text-base text-gray-700 outline-none focus:border-blue-400"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => sendMessage(transcript, inputMethodRef.current)}
              disabled={!chatReady || listening || sending || !transcript.trim()}
              className="rounded-xl bg-[#3B82F6] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? '正在回复…' : '发送'}
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            disabled={!chatReady || sending || voiceStatus === 'stopping'}
            aria-label={listening ? '停止语音输入并保留文字' : '开始语音输入'}
            aria-pressed={listening}
            className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
              listening
                ? 'scale-105 bg-red-100 text-red-500'
                : chatReady
                  ? 'bg-white text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white'
                  : 'cursor-not-allowed bg-gray-100 text-gray-300'
            }`}
          >
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="22" />
            </svg>
          </button>
          <span className={`text-xs ${listening ? 'text-red-500' : 'text-gray-400'}`}>
            {listening ? '停止并保留文字' : sending ? '正在回复…' : chatReady ? '点击说话' : '正在连接 AI…'}
          </span>
        </div>

        {voiceError && (
          <p className="pt-2 text-center text-xs text-gray-500">{voiceError}</p>
        )}
      </div>
    </div>
  )
}

export default AIChat
