import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar.jsx'
import AIAvatar from '../components/AIAvatar.jsx'
import RewardPopup from '../components/RewardPopup.jsx'
import objects from '../data/objects.js'

const DAILY_GOAL = 10

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function ObjectNamingGame() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => shuffle(objects))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [todayCompleted, setTodayCompleted] = useState(() => {
    const saved = localStorage.getItem('object_game_today')
    return saved ? Number(saved) : 0
  })
  const [step, setStep] = useState('prompting')
  const [feedbackText, setFeedbackText] = useState('')
  const [showReward, setShowReward] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [manualInput, setManualInput] = useState('')
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')

  const current = session[currentIndex]

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = 0.9
    utter.pitch = 1.1
    window.speechSynthesis.speak(utter)
  }, [])

  const checkAnswer = useCallback(
    (answer) => {
      stopListening()
      const correct = current.name
      const isCorrect = answer.includes(correct) || correct.includes(answer)

      if (isCorrect) {
        setStep('feedback_correct')
        setFeedbackText(`答对了！这就是${correct}！太棒了！🎉`)
        speak(`答对了！这就是${correct}！太棒了！`)
        setScore((s) => s + 1)
        setShowReward(true)
        const newCompleted = todayCompleted + 1
        setTodayCompleted(newCompleted)
        localStorage.setItem('object_game_today', String(newCompleted))
      } else {
        setStep('feedback_incorrect')
        setFeedbackText(`唔，你说的好像是"${answer}"，再仔细看看？🤔`)
        speak('再仔细看看图片，想一想这是什么？')
      }
    },
    [current, todayCompleted, speak],
  )

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    setTranscript('')
    transcriptRef.current = ''
    setManualInput('')

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStep('listening')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setListening(true)
      setStep('listening')
    }
    recognition.onresult = (e) => {
      const t = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      setTranscript(t)
      transcriptRef.current = t
    }
    recognition.onerror = () => {
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      const final = transcriptRef.current || manualInput
      if (final.trim()) {
        checkAnswer(final.trim())
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!current) return
    setStep('prompting')
    speak('请说出图片上的物品名称')
    setTranscript('')
    transcriptRef.current = ''
    setManualInput('')
    const timer = setTimeout(() => startListening(), 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  const goNext = useCallback(() => {
    if (currentIndex < session.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setCurrentIndex(0)
      setSession(shuffle(objects))
    }
  }, [currentIndex, session.length])

  useEffect(() => {
    if (step === 'feedback_correct') {
      const timer = setTimeout(goNext, 2500)
      return () => clearTimeout(timer)
    }
  }, [step, goNext])

  const handleRetry = () => {
    setStep('prompting')
    setFeedbackText('')
    setTranscript('')
    transcriptRef.current = ''
    setManualInput('')
    speak('请说出图片上的物品名称')
    setTimeout(() => startListening(), 1500)
  }

  const handleManualSubmit = (e) => {
    e?.preventDefault()
    if (!manualInput.trim()) return
    stopListening()
    checkAnswer(manualInput.trim())
  }

  if (!current) return null

  const isAllDone = todayCompleted >= DAILY_GOAL

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-[#3B82F6]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <h1 className="text-lg font-bold text-[#3B82F6]">物品命名游戏</h1>

        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>⭐</span>
          <span className="font-semibold text-yellow-500">{score}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mx-6 mb-4">
        <ProgressBar current={todayCompleted} total={DAILY_GOAL} />
      </div>

      {/* Main Content */}
      <main className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-12">
        {isAllDone ? (
          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="text-8xl">🎉</div>
            <h2 className="text-3xl font-bold text-[#3B82F6]">
              太棒了！今日训练全部完成！
            </h2>
            <p className="text-gray-500">
              今天认识了 {DAILY_GOAL} 个物品，继续加油！
            </p>
            <button
              onClick={() => navigate('/')}
              className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-medium text-white shadow-lg transition-all hover:bg-[#2563EB] hover:shadow-xl"
            >
              返回首页
            </button>
          </div>
        ) : (
          <>
            {/* Image Display Area */}
            <div className="relative mt-4 flex w-full max-w-2xl items-center justify-center">
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl bg-white/70 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <span className="text-[8rem] leading-none">{current.emoji}</span>
                  <p className="text-sm text-gray-400">👆 请看这幅图</p>
                </div>
              </div>

              {/* AI Avatar */}
              <div className="absolute -bottom-6 right-4 z-10">
                <AIAvatar
                  message={
                    step === 'prompting'
                      ? '请说出图片上的物品名称'
                      : step === 'listening'
                        ? '我在听你说……'
                        : feedbackText
                  }
                  speaking={step === 'prompting' || step === 'listening'}
                />
              </div>
            </div>

            {/* Input Area */}
            <div className="mt-16 flex w-full max-w-xl flex-col items-center gap-4">
              {step !== 'feedback_correct' && (
                <button
                  onClick={listening ? stopListening : startListening}
                  className={`flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-medium shadow-lg transition-all duration-300 ${
                    listening
                      ? 'scale-105 bg-red-100 text-red-500 shadow-red-200'
                      : 'bg-white text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white hover:shadow-[#3B82F6]/30'
                  }`}
                >
                  <span className="text-2xl">{listening ? '🔴' : '🎤'}</span>
                  {listening ? '正在聆听...' : '点击说话'}
                </button>
              )}

              {transcript && step === 'listening' && (
                <p className="rounded-xl bg-white/80 px-4 py-2 text-sm text-gray-500 shadow-sm">
                  听到：{transcript}
                </p>
              )}

              {step === 'listening' && (
                <form onSubmit={handleManualSubmit} className="mt-2 flex w-full gap-3">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="或者在这里输入答案..."
                    className="flex-1 rounded-2xl border border-gray-200 bg-white/80 px-5 py-3 text-sm outline-none transition-all focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                  />
                  <button
                    type="submit"
                    className="rounded-2xl bg-[#3B82F6] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#2563EB]"
                  >
                    确认
                  </button>
                </form>
              )}

              {feedbackText && (
                <div
                  className={`mt-4 animate-fade-in rounded-2xl px-6 py-4 text-center text-base font-medium shadow-md ${
                    step === 'feedback_correct'
                      ? 'bg-green-50 text-green-600'
                      : 'bg-orange-50 text-orange-500'
                  }`}
                >
                  <p>{feedbackText}</p>
                  {step === 'feedback_incorrect' && (
                    <div className="mt-3 flex justify-center gap-3">
                      <button
                        onClick={handleRetry}
                        className="rounded-xl bg-white px-5 py-2 text-sm shadow transition-all hover:bg-orange-50"
                      >
                        再试一次
                      </button>
                      <button
                        onClick={() => {
                          setStep('feedback_correct')
                          setFeedbackText(`这是${current.name}哦！${current.emoji}`)
                          speak(`这是${current.name}`)
                          setScore((s) => s + 1)
                          setShowReward(true)
                        }}
                        className="rounded-xl bg-[#3B82F6] px-5 py-2 text-sm text-white transition-all hover:bg-[#2563EB]"
                      >
                        显示答案
                      </button>
                    </div>
                  )}
                </div>
              )}

              {step === 'prompting' && (
                <p className="mt-6 text-sm text-gray-400">
                  💡 提示：{current.hint}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      <RewardPopup show={showReward} onComplete={() => setShowReward(false)} />

      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}

export default ObjectNamingGame
