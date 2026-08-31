import SpeechControls from '../components/SpeechControls.jsx'
import GameConversation from '../components/GameConversation.jsx'
import { useSpeechBusy } from '../hooks/useGentleSpeech.js'
import { useGameSpeech } from '../hooks/useGameSpeech.js'
import { cancelSpeech } from '../api/speech.js'
import { createVoiceInput } from '../api/voiceInput.js'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar.jsx'
import AIAvatar from '../components/AIAvatar.jsx'
import RewardPopup from '../components/RewardPopup.jsx'
import { fetchObjectNamingQuestions } from '../api/games.js'
import { useTrainingIdleTracker } from '../hooks/useTrainingIdleTracker.js'
import {
  finishTrainingSession,
  recordTrainingAttempt,
  startTrainingGame,
} from '../api/training.js'
import { pickGameMessage } from '../data/gameMessages.js'
import objects from '../data/objects.js'
import { matchesObjectAnswer } from '../../shared/objectNaming.js'
import { isGameConversation } from '../../shared/gameIntent.js'

const DAILY_GOAL = 10

function currentTime() {
  return Date.now()
}

// 去掉识别文本里的标点和空白，比如「苹果。」归一成「苹果」再判题
const cleanAnswer = (text) =>
  text
    .replace(/[\s，。！？、,.!?；;：:…～“”‘’"'()（）]/g, '')
    .trim()

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
  const [questionBank, setQuestionBank] = useState(objects)
  const [session, setSession] = useState(() => shuffle(objects))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [gameChatActive, setGameChatActive] = useState(false)
  const [todayCompleted, setTodayCompleted] = useState(0)
  const [step, setStep] = useState('prompting')
  const [feedbackText, setFeedbackText] = useState('')
  const [promptMessage, setPromptMessage] = useState(() =>
    pickGameMessage('objectNaming', 'prompt'),
  )
  const [listeningMessage, setListeningMessage] = useState(() =>
    pickGameMessage('objectNaming', 'listening'),
  )
  const [completionMessage] = useState(() =>
    pickGameMessage('objectNaming', 'completion', { goal: DAILY_GOAL }),
  )
  const [showReward, setShowReward] = useState(false)
  const [gameRunId, setGameRunId] = useState(null)
  const [questionsReady, setQuestionsReady] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [manualInput, setManualInput] = useState('')
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const checkAnswerRef = useRef(null)
  const manualInputRef = useRef('')
  const questionStartedAtRef = useRef(0)
  const gameStartPromiseRef = useRef(null)
  const gameConversationRef = useRef(null)
  const submittingRef = useRef(false)
  const listenTimerRef = useRef(null)

  const current = session[currentIndex]

  useTrainingIdleTracker(gameRunId, { conversationRef: gameConversationRef, questionId: current?.questionId, paused: gameChatActive || !['listening', 'feedback_incorrect'].includes(step) || todayCompleted >= DAILY_GOAL })

  useEffect(() => {
    let cancelled = false
    const loadFallbackQuestions = () => {
      return fetchObjectNamingQuestions()
        .then((questions) => {
          if (cancelled || !questions.length) return
          setQuestionBank(questions)
          setSession(shuffle(questions))
          setCurrentIndex(0)
        })
        .catch(() => {
          if (!cancelled) {
            setQuestionBank(objects)
            setSession((currentSession) =>
              currentSession.length ? currentSession : shuffle(objects),
            )
          }
        })
    }

    if (!gameStartPromiseRef.current) {
      gameStartPromiseRef.current = startTrainingGame('object-naming')
    }

    gameStartPromiseRef.current
      .then((training) => {
        if (cancelled) return
        const questions = training?.gameRun.questions.map((question) => ({
          questionId: question.id,
          emoji: question.assetValue,
          hint: question.hint,
          prompt: question.prompt,
        }))
        if (!questions?.length) {
          return loadFallbackQuestions()
        }
        setGameRunId(training.gameRun.id)
        setQuestionBank(questions)
        setSession(shuffle(questions))
        setCurrentIndex(0)
      })
      .catch(loadFallbackQuestions)
      .finally(() => { if (!cancelled) setQuestionsReady(true) })

    return () => {
      cancelled = true
    }
  }, [])

  const speak = useGameSpeech(gameConversationRef)
  const speechBusy = useSpeechBusy()

  const stopListening = useCallback(() => {
    clearTimeout(listenTimerRef.current)
    recognitionRef.current?.dispose()
    recognitionRef.current = null
    setListening(false)
  }, [])

  useEffect(() => () => {
    clearTimeout(listenTimerRef.current)
    recognitionRef.current?.dispose()
  }, [])

  const checkAnswer = useCallback(
    async (answer, inputMethod = 'ASR') => {
      if (submittingRef.current) return
      stopListening()
      if (!current.questionId && isGameConversation(answer)) {
        submittingRef.current = true
        setStep('chatting')
        try { await gameConversationRef.current?.ask(answer, inputMethod) }
        finally { submittingRef.current = false; setStep('listening') }
        return
      }
      const cleaned = cleanAnswer(answer)
      if (!cleaned) return // 识别到的全是标点，忽略，不判题
      gameConversationRef.current?.record('user', answer.trim())
      let isCorrect
      let apiFeedback
      if (current.questionId) {
        submittingRef.current = true
        setStep('submitting')
        try {
          const attempt = await recordTrainingAttempt({
            questionId: current.questionId,
            answer: answer.trim(),
            inputMethod,
            responseTimeMs: currentTime() - questionStartedAtRef.current,
          })
          if (!attempt) throw new Error('请先登录并开始训练，本次不计对错。')
          if (attempt.outcome === 'CONVERSATION') {
            setManualInput('')
            setTranscript('')
            manualInputRef.current = ''
            setStep('listening')
            setFeedbackText('')
            speak(attempt.feedback)
            return
          }
          isCorrect = attempt.isCorrect
          apiFeedback = attempt.provider === 'qwen' ? attempt.feedback : null
        } catch (error) {
          setStep('listening')
          setFeedbackText(error.message || '暂时无法判断，本次不计对错，请重试。')
          return
        } finally {
          submittingRef.current = false
        }
      } else {
        const correct = current.name
        isCorrect = matchesObjectAnswer(cleaned, [correct])
      }

      setManualInput('')
      setTranscript('')
      manualInputRef.current = ''
      if (isCorrect) {
        setStep('feedback_correct')
        const message = pickGameMessage('objectNaming', 'correct', {
          answer: current.name,
        })
        setFeedbackText(apiFeedback || message.display)
        speak(apiFeedback || message.speech)
        setScore((s) => s + 1)
        setShowReward(true)
        setTodayCompleted((n) => n + 1)
      } else {
        setStep('feedback_incorrect')
        const message = pickGameMessage('objectNaming', 'incorrect', {
          heard: cleaned,
        })
        setFeedbackText(apiFeedback || message.display)
        speak(apiFeedback || message.speech)
      }
    },
    [current, speak, stopListening],
  )

  // 每次渲染后把最新的 checkAnswer/manualInput 同步进 ref，
  // 防止 startListening 里 recognition.onend 捕获到旧闭包（旧题目的 current）
  useEffect(() => {
    checkAnswerRef.current = checkAnswer
    manualInputRef.current = manualInput
  })
  const startListening = useCallback(() => {
    if (submittingRef.current) return
    cancelSpeech()
    stopListening()
    setStep('listening')
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition || !window.isSecureContext) {
      setFeedbackText('当前环境无法使用语音识别，可以在下方输入文字。')
      return
    }
    recognitionRef.current = createVoiceInput({
      Recognition,
      initialText: manualInputRef.current,
      onText: (text) => {
        setTranscript(text)
        transcriptRef.current = text
        setManualInput(text)
        manualInputRef.current = text
      },
      onStatus: (status) => setListening(status !== 'idle'),
      onError: setFeedbackText,
      onAutoSend: (text) => checkAnswerRef.current(text, 'ASR'),
    })
    recognitionRef.current.start()
  }, [stopListening])

  // 提问：等 AI 语音播报结束后再开始听，避免 AI 的声音被识别成答案
  const promptAndListen = useCallback(
    (message) => {
      setStep('prompting')
      setFeedbackText('')
      setTranscript('')
      transcriptRef.current = ''
      setManualInput('')
      setPromptMessage(message)
      setListeningMessage(pickGameMessage('objectNaming', 'listening'))
      let started = false
      const beginListening = () => {
        if (started) return
        started = true
        // 停掉残留的 AI 语音，防止麦克风把播报拾音进去
        cancelSpeech()
        listenTimerRef.current = setTimeout(startListening, 300)
      }
      speak(message.speech, beginListening)
    },
    [speak, startListening],
  )

  useEffect(() => {
    if (!current || !questionsReady) return
    questionStartedAtRef.current = currentTime()
    // 延迟一帧执行，避免在 effect 里同步 setState（react-hooks/set-state-in-effect）
    const timer = setTimeout(() => {
      promptAndListen(pickGameMessage('objectNaming', 'prompt'))
    }, 0)
    return () => clearTimeout(timer)
  }, [currentIndex, current, promptAndListen, questionsReady])

  const goNext = useCallback(() => {
    if (currentIndex < session.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setCurrentIndex(0)
      setSession(shuffle(questionBank))
    }
  }, [currentIndex, questionBank, session.length])

  useEffect(() => {
    if (step === 'feedback_correct' && !speechBusy && !gameChatActive && todayCompleted < DAILY_GOAL) {
      const timer = setTimeout(goNext, 2500)
      return () => clearTimeout(timer)
    }
  }, [step, goNext, speechBusy, todayCompleted, gameChatActive])

  const handleRetry = () => {
    promptAndListen(pickGameMessage('objectNaming', 'prompt'))
  }

  const handleManualSubmit = (e) => {
    e?.preventDefault()
    if (!manualInput.trim()) return
    stopListening()
    checkAnswer(manualInput.trim(), 'TEXT')
  }

  const leaveTraining = async (reason, target = '/') => {
    stopListening()
    try {
      await finishTrainingSession({ reason })
    } finally {
      navigate(target)
    }
  }

  const revealAnswer = async () => {
    let revealedAnswer = current.name
    if (current.questionId) {
      setStep('submitting')
      try {
        const attempt = await recordTrainingAttempt({
          questionId: current.questionId,
          action: 'REVEAL',
          responseTimeMs: currentTime() - questionStartedAtRef.current,
        })
        if (!attempt?.isRevealed || !attempt.revealedAnswer) {
          throw new Error('REVEAL_ANSWER_UNAVAILABLE')
        }
        revealedAnswer = attempt.revealedAnswer
      } catch {
        setStep('feedback_incorrect')
        setFeedbackText(
          pickGameMessage('objectNaming', 'revealError').display,
        )
        return
      }
    }

    setStep('feedback_correct')
    const message = pickGameMessage('objectNaming', 'reveal', {
      answer: revealedAnswer,
      emoji: current.emoji,
    })
    setFeedbackText(message.display)
    speak(message.speech)
    setTodayCompleted((n) => n + 1)
  }

  if (!current) return null

  const isAllDone = todayCompleted >= DAILY_GOAL

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => leaveTraining('LEAVE_OBJECT_NAMING', '/patient/games')}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-[#3B82F6]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <h1 className="text-2xl font-bold text-[#3B82F6]">物品命名游戏</h1>

        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>⭐</span>
          <span className="font-semibold text-yellow-500">{score}</span>
        </div>
      </div>

      <SpeechControls />
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
              {completionMessage.display}
            </h2>
            <p className="text-gray-500">
              {completionMessage.detail}
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
                      ? promptMessage.display
                      : step === 'listening'
                        ? listeningMessage.display
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
                  disabled={step === 'chatting' || gameChatActive}
                  onClick={listening ? () => recognitionRef.current?.stop() : startListening}
                  className={`flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-medium shadow-lg transition-all duration-300 ${
                    listening
                      ? 'scale-105 bg-red-100 text-red-500 shadow-red-200'
                      : 'bg-white text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white hover:shadow-[#3B82F6]/30'
                  }`}
                >
                  <span className="text-2xl">{listening ? '🔴' : '🎤'}</span>
                  {listening ? '停止并保留文字' : '点击说话'}
                </button>
              )}

              {step !== 'feedback_correct' && <p className="text-xs text-gray-500">停顿 2 秒自动发送，想要提示或觉得困难都可以说。</p>}

              {transcript && step === 'listening' && (
                <p className="rounded-xl bg-white/80 px-4 py-2 text-sm text-gray-500 shadow-sm">
                  听到：{transcript}
                </p>
              )}

              {step === 'listening' && (
                <form onSubmit={handleManualSubmit} className="animate-fade-in mt-2 flex w-full gap-3">
                  <input
                    type="text"
                    disabled={gameChatActive}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="输入答案，也可以问小星要提示..."
                    className="flex-1 rounded-2xl border border-gray-200 bg-white/80 px-5 py-3 text-sm outline-none transition-all focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                  />
                  <button
                    disabled={gameChatActive}
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
                        onClick={revealAnswer}
                        className="rounded-xl bg-[#3B82F6] px-5 py-2 text-sm text-white transition-all hover:bg-[#2563EB]"
                      >
                        显示答案
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(step === 'prompting' || step === 'listening') && (
                <p className="mt-6 text-sm text-gray-400">
                  💡 提示：{current.hint}
                </p>
              )}
            </div>
          </>
        )}
        <GameConversation onActivity={setGameChatActive} ref={gameConversationRef} gameRunId={gameRunId} questionId={current.questionId} context="OBJECT_NAMING" onBeforeListen={stopListening} />
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
