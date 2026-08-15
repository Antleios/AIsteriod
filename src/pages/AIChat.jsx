import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AiMascot from '../components/AiMascot.jsx'
import { requestAIMessage } from '../api/ai.js'

const MOCK_GREETING = '你好，我是小星！按住下方按钮，就可以和我说话啦。'

const fmt = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function AIChat() {
  const navigate = useNavigate()

  const [callState, setCallState] = useState('connecting') // connecting | connected | ended
  const [mascotState, setMascotState] = useState('connecting') // connecting | listening | speaking | idle
  const [conversation, setConversation] = useState([]) // [{ role, content }]，真实 AI 接入时即完整对话历史
  const [transcript, setTranscript] = useState('') // 用户本次说的话
  const [lastReply, setLastReply] = useState('') // 小星最近一次回复
  const [elapsed, setElapsed] = useState(0) // 通话秒数（结束时显示时长）
  const [listening, setListening] = useState(false)
  const [sessionId, setSessionId] = useState(0) // 重新呼叫时 +1，触发重连

  // ref：避免 SpeechRecognition onend / 异步回调里读到过期闭包
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const callStateRef = useRef(callState)
  const conversationRef = useRef(conversation)
  const handlingRef = useRef(false) // 等待 AI 回复期间锁住，禁止再次说话
  const handleUserUtteranceRef = useRef(null)

  useEffect(() => {
    callStateRef.current = callState
    conversationRef.current = conversation
  }, [callState, conversation])

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

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }
    setListening(false)
  }, [])

  const handleUserUtterance = useCallback(
    async (text) => {
      if (callStateRef.current !== 'connected' || handlingRef.current) return
      handlingRef.current = true
      setConversation((prev) => [...prev, { role: 'user', content: text }])
      setTranscript(text)
      setMascotState('listening') // 「思考中」的样子
      try {
        const nextMessages = [
          ...conversationRef.current,
          { role: 'user', content: text },
        ]
        const { reply } = await requestAIMessage(nextMessages) // 唯一 AI 入口
        if (callStateRef.current !== 'connected') return
        setConversation((prev) => [...prev, { role: 'assistant', content: reply }])
        setTranscript('')
        setLastReply(reply)
        setMascotState('speaking') // 语音播放时嘴型跟着动
        speak(reply, () => {
          setMascotState('idle')
          handlingRef.current = false
        })
      } catch {
        setMascotState('idle')
        handlingRef.current = false
      }
    },
    [speak],
  )

  // 每次渲染后同步最新 handleUserUtterance 到 ref，供 onend 调用
  useEffect(() => {
    handleUserUtteranceRef.current = handleUserUtterance
  })

  const startListening = useCallback(() => {
    setTranscript('')
    transcriptRef.current = ''

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
      setMascotState('listening')
    }
    recognition.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      setTranscript(text)
      transcriptRef.current = text
    }
    recognition.onerror = () => {
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      const final = transcriptRef.current.trim()
      if (final) {
        handleUserUtteranceRef.current?.(final)
      } else {
        setMascotState((s) => (s === 'listening' ? 'idle' : s))
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  // 连接流程：keyed by sessionId，重新呼叫会重跑
  useEffect(() => {
    let cancelled = false
    const t1 = setTimeout(() => {
      if (cancelled) return
      setCallState('connected')
      setMascotState('speaking')
      setTimeout(() => {
        if (cancelled) return
        speak(MOCK_GREETING, () => {
          if (!cancelled) setMascotState('idle')
        })
      }, 500)
    }, 1400)

    return () => {
      cancelled = true
      clearTimeout(t1)
      stopListening()
      if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
  }, [sessionId, speak, stopListening])

  // 通话计时：仅连接后开始
  useEffect(() => {
    if (callState !== 'connected') return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [callState])

  const handleHangUp = () => {
    stopListening()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    handlingRef.current = false
    setCallState('ended')
    setMascotState('idle')
  }

  const handleMicDown = (e) => {
    e.preventDefault()
    if (callStateRef.current !== 'connected' || handlingRef.current) return
    startListening()
  }

  const handleMicUp = () => stopListening()

  const restartCall = () => {
    stopListening()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    handlingRef.current = false
    setConversation([])
    setTranscript('')
    setLastReply('')
    setElapsed(0)
    setCallState('connecting')
    setMascotState('connecting')
    setSessionId((s) => s + 1)
  }

  const unsupported =
    !window.SpeechRecognition && !window.webkitSpeechRecognition

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

      <main className="mx-auto flex max-w-lg flex-col items-center px-4 pb-12">
        {callState === 'ended' ? (
          /* —— 通话结束 —— */
          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-gray-400 shadow-xl">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#1E3A5F]">通话已结束</h2>
            <p className="text-gray-500">本次通话时长 {fmt(elapsed)}</p>
            <div className="mt-2 flex gap-4">
              <button
                onClick={restartCall}
                className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-medium text-white shadow-lg transition-all hover:bg-[#2563EB]"
              >
                重新呼叫
              </button>
              <button
                onClick={() => navigate('/patient')}
                className="rounded-2xl bg-white px-8 py-3 font-medium text-[#3B82F6] shadow-lg transition-all hover:bg-[#EAF4FF]"
              >
                返回
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* —— 圆形吉祥物小星（眼睛跟随鼠标） —— */}
            <div className="mt-6">
              <AiMascot
                speaking={mascotState === 'speaking'}
                listening={mascotState === 'listening'}
                connecting={mascotState === 'connecting'}
                size={250}
              />
            </div>

            {/* —— 语音气泡 / 状态 —— */}
            <div className="mt-8 min-h-[3.5rem] max-w-sm rounded-2xl bg-white/80 px-4 py-2.5 text-center text-sm text-gray-600 shadow-sm backdrop-blur-sm">
              {callState === 'connecting'
                ? '正在连接小星…'
                : transcript
                  ? `「${transcript}」`
                  : lastReply || '按住下方按钮，就可以和我说话啦'}
            </div>

            {/* —— 控制区：按住说话 + 挂断 —— */}
            <div className="mt-8 flex items-center gap-16">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onPointerDown={handleMicDown}
                  onPointerUp={handleMicUp}
                  onPointerLeave={handleMicUp}
                  onPointerCancel={handleMicUp}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={callState !== 'connected'}
                  className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                    listening
                      ? 'bg-red-100 text-red-500'
                      : 'bg-white text-[#3B82F6] hover:shadow-xl'
                  }`}
                  aria-label="按住说话"
                >
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="17" x2="12" y2="22" />
                  </svg>
                </button>
                <span className="text-xs text-gray-400">按住说话</span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={handleHangUp}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-600 hover:shadow-xl active:scale-90"
                  aria-label="挂断"
                >
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
                <span className="text-xs text-gray-400">
                  {callState === 'connecting' ? '取消' : '挂断'}
                </span>
              </div>
            </div>

            {/* 不支持语音识别的提示 */}
            {unsupported && (
              <p className="mt-4 rounded-xl bg-white/80 px-4 py-2 text-xs text-gray-500 shadow-sm">
                当前浏览器不支持语音识别，请使用 Chrome / Edge 体验语音通话。
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default AIChat
