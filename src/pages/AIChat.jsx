import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AiMascot from '../components/AiMascot.jsx'
import { requestAIMessage } from '../api/ai.js'

const GREETING = '你好，我是小星！我看到你了，想聊点什么呢？'

function AIChat() {
  const navigate = useNavigate()

  const [conversation, setConversation] = useState([]) // [{ role, content }]，真实 AI 接入时即完整对话历史
  const [transcript, setTranscript] = useState('') // 正在聆听时实时回显
  const [mascotExpression, setMascotExpression] = useState('calm') // calm | loving
  const [listening, setListening] = useState(false) // 正在聆听用户说话
  const [voiceError, setVoiceError] = useState('')

  const handlingRef = useRef(false) // 等待 AI 回复期间锁住，禁止连续发送
  const loveTimeoutRef = useRef(null) // 「喜欢」表情的计时器
  const sendMessageRef = useRef(null) // 供语音 onend 调用最新的 sendMessage
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const suppressSendRef = useRef(false) // 用户手动停止聆听时不自动发送
  const chatEndRef = useRef(null)

  const speak = useCallback((text, onEnd) => {
    if (!window.speechSynthesis) {
      onEnd?.()
      return
    }
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = 0.9
    utter.pitch = 1.1
    if (onEnd) {
      utter.onend = onEnd
      utter.onerror = onEnd
    }
    window.speechSynthesis.speak(utter)
  }, [])

  // 显示「喜欢」表情（头顶冒小爱心），4 秒后恢复平静
  const showLoving = useCallback(() => {
    setMascotExpression('loving')
    if (loveTimeoutRef.current) clearTimeout(loveTimeoutRef.current)
    loveTimeoutRef.current = setTimeout(() => setMascotExpression('calm'), 4000)
  }, [])

  const sendMessage = useCallback(
    async (raw, inputMethod = 'TEXT') => {
      const content = (raw ?? '').trim()
      if (!content || handlingRef.current) return
      handlingRef.current = true

      const userMsg = { role: 'user', content }
      const nextMessages = [...conversation, userMsg]
      setConversation(nextMessages)

      // 听到喜欢的话 → 立刻换成「喜欢」表情（冒小爱心）
      const positive = /喜欢|谢谢|感谢|爱|棒|开心|好呀|好哒|真棒|聪明|爱你|感谢你/.test(content)

      try {
        const { reply } = await requestAIMessage(nextMessages, { inputMethod })
        setConversation((prev) => [...prev, { role: 'assistant', content: reply }])
        // 用户的话或 AI 回复里带积极词，都会触发爱心
        const positiveReply = /喜欢|谢谢|感谢|爱|棒|开心|好呀|好哒|真棒|聪明|加油|太棒/.test(reply)
        if (positive || positiveReply) {
          showLoving()
        } else {
          setMascotExpression('calm')
        }
        speak(reply, () => {
          handlingRef.current = false
        })
      } catch {
        handlingRef.current = false
        setMascotExpression('calm')
      }
    },
    [conversation, speak, showLoving],
  )

  // 每次渲染后同步最新 sendMessage 到 ref，供语音 onend 回调调用
  useEffect(() => {
    sendMessageRef.current = sendMessage
  })

  // 开场白：小星先打招呼
  useEffect(() => {
    setConversation([{ role: 'assistant', content: GREETING }])
    speak(GREETING)
  }, [speak])

  // 新消息自动滚到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch { /* ignore */ }
    }
    recognitionRef.current = null
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceError('当前浏览器不支持语音识别，请使用 Chrome / Edge 体验语音聊天')
      return
    }
    // 停掉 AI 正在播报的语音，防止被麦克风拾音进去
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    setVoiceError('')
    setListening(true)
    setTranscript('')
    transcriptRef.current = ''
    suppressSendRef.current = false

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (e) => {
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript
      }
      transcriptRef.current = text
      setTranscript(text)
    }
    recognition.onerror = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      const final = transcriptRef.current.trim()
      transcriptRef.current = ''
      setTranscript('')
      if (final && !suppressSendRef.current) {
        sendMessageRef.current(final, 'ASR') // 说完自动发送
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  // 手动停止聆听：不自动发送当前内容
  const cancelListening = useCallback(() => {
    suppressSendRef.current = true
    stopListening()
  }, [stopListening])

  const toggleListening = useCallback(() => {
    if (listening) {
      cancelListening()
    } else {
      startListening()
    }
  }, [listening, cancelListening, startListening])

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (loveTimeoutRef.current) clearTimeout(loveTimeoutRef.current)
      stopListening()
      if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [stopListening])

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

      {/* 语音控制区：只有麦克风，说完自动发送 */}
      <div className="border-t border-white/50 bg-white/60 px-4 py-4 backdrop-blur-sm">
        {listening && (
          <div className="pb-3 text-center">
            <p className="text-sm font-medium text-[#3B82F6]">
              🎤 正在聆听…说完会自动发送
            </p>
            {transcript && (
              <p className="mx-auto mt-1.5 max-w-sm rounded-xl bg-white/80 px-3 py-1.5 text-sm text-gray-600 shadow-sm">
                {transcript}
              </p>
            )}
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            aria-label="语音输入"
            className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
              listening
                ? 'scale-105 bg-red-100 text-red-500'
                : 'bg-white text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white'
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
            {listening ? '点击停止' : '点击说话'}
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
