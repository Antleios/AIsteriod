import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar.jsx'
import AIAvatar from '../components/AIAvatar.jsx'
import RewardPopup from '../components/RewardPopup.jsx'
import { fetchEmojiMatchQuestions } from '../api/games.js'
import { useTrainingIdleTracker } from '../hooks/useTrainingIdleTracker.js'
import {
  finishTrainingSession,
  recordTrainingAttempt,
  startTrainingGame,
} from '../api/training.js'
import emotionSets from '../data/emotionEmojis.js'

const DAILY_GOAL = 8

function currentTime() {
  return Date.now()
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function EmojiGame() {
  const navigate = useNavigate()
  const [questionBank, setQuestionBank] = useState([])
  const [rounds, setRounds] = useState([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [todayCompleted, setTodayCompleted] = useState(0)
  const [step, setStep] = useState('prompting') // prompting | waiting | correct | wrong
  const [selectedId, setSelectedId] = useState(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [showReward, setShowReward] = useState(false)
  const [gameRunId, setGameRunId] = useState(null)
  const questionStartedAtRef = useRef(0)
  const gameStartPromiseRef = useRef(null)

  const current = rounds[roundIndex]

  useTrainingIdleTracker(gameRunId)

  useEffect(() => {
    let cancelled = false
    const fallbackToLocalQuestions = () => {
      setQuestionBank(emotionSets)
      setRounds(shuffle(emotionSets))
      setRoundIndex(0)
    }

    if (!gameStartPromiseRef.current) {
      gameStartPromiseRef.current = startTrainingGame('emoji-match')
    }

    gameStartPromiseRef.current
      .then((training) => {
        if (cancelled) return
        const questions = training?.gameRun.questions.map((question) => ({
          questionId: question.id,
          target: question.prompt,
          options: question.options.map((option) => ({
            id: option.id,
            emoji: option.displayValue,
            name: option.label,
          })),
        }))
        if (!questions?.length) {
          fallbackToLocalQuestions()
          return
        }
        setGameRunId(training.gameRun.id)
        setQuestionBank(questions)
        setRounds(shuffle(questions))
        setRoundIndex(0)
      })
      .catch(() =>
        fetchEmojiMatchQuestions()
          .then((questions) => {
            if (cancelled || !questions.length) return fallbackToLocalQuestions()
            setQuestionBank(questions)
            setRounds(shuffle(questions))
            setRoundIndex(0)
          })
          .catch(() => {
            if (!cancelled) fallbackToLocalQuestions()
          }),
      )

    return () => {
      cancelled = true
    }
  }, [])

  const shuffledOptions = useMemo(
    () => (current ? shuffle(current.options) : []),
    [current],
  )

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = 0.9
    utter.pitch = 1.1
    window.speechSynthesis.speak(utter)
  }, [])

  // Initialize each round
  useEffect(() => {
    if (!current) return
    setStep('prompting')
    setSelectedId(null)
    setFeedbackText('')
    questionStartedAtRef.current = currentTime()
    const msg = `请选出表示"${current.target}"的表情`
    speak(msg)
    const timer = setTimeout(() => {
      setStep('waiting')
    }, 2000)
    return () => clearTimeout(timer)
  }, [current, speak])

  const handleSelect = useCallback(
    async (opt, index) => {
      if (step !== 'waiting') return
      setSelectedId(index)

      setStep('submitting')
      let attempt = null
      try {
        if (current.questionId) {
          attempt = await recordTrainingAttempt({
            questionId: current.questionId,
            answer: opt.id,
            responseTimeMs: currentTime() - questionStartedAtRef.current,
          })
        }
      } catch {
        // A server failure must not prevent the existing offline question bank.
      }

      if (current.questionId && !attempt) {
        setStep('waiting')
        setSelectedId(null)
        setFeedbackText('训练记录暂不可用，请再试一次。')
        return
      }

      if (attempt?.isCorrect ?? opt.correct) {
        setStep('correct')
        setFeedbackText(`答对了！${opt.emoji} 就是${current.target}！太棒了！🎉`)
        speak(`答对了！${opt.emoji} 就是${current.target}！太棒了！`)
        setScore((s) => s + 1)
        setShowReward(true)
        setTodayCompleted((n) => n + 1)
      } else {
        setStep('wrong')
        setFeedbackText(
          `${opt.emoji} 是"${opt.name}"哦，再想想哪个是"${current.target}"？🤔`,
        )
        speak(`再想想哪个是${current.target}`)
      }
    },
    [step, current, speak],
  )

  const goNext = useCallback(() => {
    if (roundIndex < rounds.length - 1) {
      setRoundIndex((i) => i + 1)
    } else {
      setRounds(shuffle(questionBank))
      setRoundIndex(0)
    }
  }, [questionBank, roundIndex, rounds.length])

  useEffect(() => {
    if (step === 'correct') {
      const timer = setTimeout(goNext, 2500)
      return () => clearTimeout(timer)
    }
  }, [step, goNext])

  const isAllDone = todayCompleted >= DAILY_GOAL

  const leaveTraining = async (reason, target = '/') => {
    try {
      await finishTrainingSession({ reason })
    } finally {
      navigate(target)
    }
  }

  if (!current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60 text-[#3B82F6]">
        <p className="text-lg font-semibold">正在加载题库...</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => leaveTraining('LEAVE_EMOJI_MATCH', '/patient/games')}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-[#3B82F6]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <h1 className="text-2xl font-bold text-[#3B82F6]">表情匹配游戏</h1>

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
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-start px-4 pb-12 pt-16">
        {isAllDone ? (
          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="text-8xl">🎉</div>
            <h2 className="text-3xl font-bold text-[#3B82F6]">
              太棒了！今日表情训练全部完成！
            </h2>
            <p className="text-gray-500">
              今天认识了 {DAILY_GOAL} 种情绪表情，继续加油！
            </p>
            <button
              onClick={() => leaveTraining('GAME_COMPLETE')}
              className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-medium text-white shadow-lg transition-all hover:bg-[#2563EB] hover:shadow-xl"
            >
              返回首页
            </button>
          </div>
        ) : (
          <>
            {/* Prompt Area */}
            <div className="mt-6 animate-fade-in rounded-3xl bg-white/70 px-10 py-6 shadow-lg backdrop-blur-sm">
              <p className="text-center text-lg text-gray-500">请选出表示</p>
              <p className="mt-1 text-center text-4xl font-bold text-[#3B82F6]">
                "{current.target}"
              </p>
              <p className="mt-1 text-center text-lg text-gray-500">的表情</p>
            </div>

            {/* Emoji Options */}
            <div className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
              {shuffledOptions.map((opt, i) => {
                const isSelected = selectedId === i
                const isCorrectReveal =
                  step === 'correct' && opt.correct
                const isWrongReveal = step === 'wrong' && isSelected

                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(opt, i)}
                    disabled={step !== 'waiting'}
                    className={`group flex flex-col items-center gap-3 rounded-3xl p-7 shadow-lg backdrop-blur-sm transition-all duration-300 ${
                      step !== 'waiting'
                        ? isCorrectReveal
                          ? 'scale-105 bg-green-100 shadow-green-200'
                          : isWrongReveal
                            ? 'scale-95 bg-red-50 shadow-red-100'
                            : 'bg-white/60 opacity-60'
                        : 'bg-white/60 hover:-translate-y-2 hover:bg-white hover:shadow-xl'
                    } ${isSelected && step === 'wrong' ? 'ring-2 ring-red-300' : ''}`}
                  >
                    <span className="text-6xl transition-transform duration-300 group-hover:scale-110">
                      {opt.emoji}
                    </span>
                    {isCorrectReveal && (
                      <span className="text-sm text-green-500">✅ 正确</span>
                    )}
                    {isWrongReveal && (
                      <span className="text-sm text-red-400">❌</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Feedback */}
            {feedbackText && (
              <div
                className={`mt-8 animate-fade-in rounded-2xl px-6 py-4 text-center text-base font-medium shadow-md ${
                  step === 'correct'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-orange-50 text-orange-500'
                }`}
              >
                <p>{feedbackText}</p>
                {step === 'wrong' && (
                  <button
                    onClick={() => {
                      setStep('waiting')
                      setSelectedId(null)
                      setFeedbackText('')
                      speak(`请选出表示${current.target}的表情`)
                    }}
                    className="mt-3 rounded-xl bg-white px-5 py-2 text-sm shadow transition-all hover:bg-orange-50"
                  >
                    再试一次
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* AI Avatar floating */}
      <div className="fixed bottom-8 right-8 z-10">
        <AIAvatar
          message={
            step === 'prompting'
              ? `请选出表示"${current.target}"的表情`
              : step === 'waiting'
                ? `点击你觉得是"${current.target}"的表情吧`
                : feedbackText
          }
          speaking={step === 'prompting'}
        />
      </div>

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

export default EmojiGame
