import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar.jsx'
import AIAvatar from '../components/AIAvatar.jsx'
import RewardPopup from '../components/RewardPopup.jsx'
import { generateColorRound, colorPalette } from '../data/colorItems.js'

const DAILY_GOAL = 5
const TOTAL_PAIRS = 5
const ITEMS_PER_PAIR = 2

function ColorLineGame() {
  const navigate = useNavigate()
  const [score, setScore] = useState(0)
  const [todayCompleted, setTodayCompleted] = useState(() => {
    const saved = localStorage.getItem('color_game_today')
    return saved ? Number(saved) : 0
  })
  const [items, setItems] = useState(() => generateColorRound())
  const [selectedId, setSelectedId] = useState(null)
  const [matches, setMatches] = useState([]) // [{ id1, id2, color }]
  const [step, setStep] = useState('prompting') // prompting | playing | correct | wrong | complete
  const [feedbackText, setFeedbackText] = useState('')
  const [showReward, setShowReward] = useState(false)
  const [roundKey, setRoundKey] = useState(0)

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = 0.9
    window.speechSynthesis.speak(utter)
  }, [])

  // Init round
  useEffect(() => {
    setStep('prompting')
    setSelectedId(null)
    const msg = '请把相同颜色的物品连起来'
    speak(msg)
    const timer = setTimeout(() => setStep('playing'), 2000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey])

  // Check if all pairs matched
  useEffect(() => {
    if (matches.length === TOTAL_PAIRS && step === 'correct') {
      const timer = setTimeout(() => {
        setStep('complete')
        setFeedbackText('')
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [matches.length, step])

  const matchedColorIds = new Set(
    matches.flatMap((m) => [m.id1, m.id2]),
  )

  const handleItemClick = useCallback(
    (item) => {
      if (step !== 'playing') return
      if (matchedColorIds.has(item.id)) return

      if (selectedId === null) {
        // First selection
        setSelectedId(item.id)
        speak(`选中的是${item.label}`)
      } else {
        // Second selection – attempt match
        const first = items.find((i) => i.id === selectedId)
        if (first.color === item.color) {
          // Correct match
          const newMatches = [
            ...matches,
            { id1: first.id, id2: item.id, color: item.color },
          ]
          setMatches(newMatches)
          setSelectedId(null)
          setStep('correct')
          setFeedbackText(
            `太棒了！${first.label}和${item.label}是相同颜色！🎉`,
          )
          speak(`${first.label}和${item.label}配对成功！`)
          setScore((s) => s + 1)
          setShowReward(true)

          if (newMatches.length === TOTAL_PAIRS) {
            const newVal = todayCompleted + 1
            setTodayCompleted(newVal)
            localStorage.setItem('color_game_today', String(newVal))
          }
        } else {
          // Wrong match
          setStep('wrong')
          setFeedbackText(
            `这两个颜色不一样哦，${first.label}和${item.label}是不同的颜色🤔`,
          )
          speak('这两个颜色不一样，再试试吧')
          setTimeout(() => {
            setSelectedId(null)
            setStep('playing')
            setFeedbackText('')
          }, 2000)
        }
      }
    },
    [step, selectedId, items, matches, todayCompleted, speak, matchedColorIds],
  )

  // Advance after correct
  useEffect(() => {
    if (step === 'correct' && matches.length < TOTAL_PAIRS) {
      const timer = setTimeout(() => {
        setStep('playing')
        setFeedbackText('')
      }, 1800)
      return () => clearTimeout(timer)
    }
  }, [step, matches.length])

  const nextRound = () => {
    setItems(generateColorRound())
    setMatches([])
    setSelectedId(null)
    setStep('prompting')
    setRoundKey((k) => k + 1)
  }

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

        <h1 className="text-lg font-bold text-[#3B82F6]">颜色连线游戏</h1>

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
              太棒了！今日颜色训练全部完成！
            </h2>
            <p className="text-gray-500">
              今天完成了 {DAILY_GOAL} 组颜色配对，继续加油！
            </p>
            <button
              onClick={() => navigate('/')}
              className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-medium text-white shadow-lg transition-all hover:bg-[#2563EB] hover:shadow-xl"
            >
              返回首页
            </button>
          </div>
        ) : step === 'complete' ? (
          /* Round complete */
          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="text-8xl">🎉</div>
            <h2 className="text-3xl font-bold text-[#3B82F6]">
              这一轮全部配对成功！
            </h2>
            <p className="text-gray-500">
              你成功匹配了所有 {TOTAL_PAIRS} 对颜色！
            </p>
            <button
              onClick={nextRound}
              className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-medium text-white shadow-lg transition-all hover:bg-[#2563EB] hover:shadow-xl"
            >
              下一轮
            </button>
          </div>
        ) : (
          <>
            {/* Game Board */}
            <div className="relative mt-4 w-full max-w-3xl">
              <div className="relative aspect-[5/3] w-full rounded-3xl bg-white/70 shadow-lg backdrop-blur-sm">
                {/* SVG Lines layer */}
                <svg className="absolute inset-0 h-full w-full pointer-events-none">
                  {matches.map((m, i) => {
                    const a = items.find((it) => it.id === m.id1)
                    const b = items.find((it) => it.id === m.id2)
                    if (!a || !b) return null
                    const pctW = 82
                    const pctH = 70
                    const padX = 9
                    const padY = 15
                    const x1 = padX + (a.x / 100) * pctW
                    const y1 = padY + (a.y / 100) * pctH
                    const x2 = padX + (b.x / 100) * pctW
                    const y2 = padY + (b.y / 100) * pctH
                    const cx = (x1 + x2) / 2
                    const cy = (y1 + y2) / 2
                    return (
                      <g key={i}>
                        <line
                          x1={`${x1}%`}
                          y1={`${y1}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          stroke={m.color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          className="animate-line-draw"
                        />
                        <circle
                          cx={`${cx}%`}
                          cy={`${cy}%`}
                          r="6"
                          fill={m.color}
                          className="animate-line-draw"
                        />
                      </g>
                    )
                  })}
                </svg>

                {/* Items */}
                {items.map((item) => {
                  const matched = matchedColorIds.has(item.id)
                  const selected = selectedId === item.id
                  const pctW = 82
                  const pctH = 70
                  const padX = 9
                  const padY = 15
                  const left = padX + (item.x / 100) * pctW
                  const top = padY + (item.y / 100) * pctH

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      disabled={matched || step !== 'playing'}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                        matched
                          ? 'opacity-40 scale-90 cursor-default'
                          : selected
                            ? 'scale-125 z-20'
                            : step === 'playing'
                              ? 'hover:scale-110 cursor-pointer'
                              : 'cursor-default'
                      }`}
                      style={{ left: `${left}%`, top: `${top}%` }}
                    >
                      <div
                        className={`flex items-center justify-center ${
                          item.shape === 'circle'
                            ? 'h-14 w-14 rounded-full'
                            : 'h-12 w-12 rounded-xl'
                        } text-white text-xs font-bold shadow-lg transition-all duration-300 ${
                          selected ? 'ring-4 ring-white ring-offset-2 ring-offset-[#3B82F6]/30' : ''
                        }`}
                        style={{ backgroundColor: item.color }}
                      >
                        {item.shape === 'circle' ? '●' : '■'}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* AI Avatar */}
              <div className="absolute -bottom-6 right-4 z-10">
                <AIAvatar
                  message={
                    step === 'prompting'
                      ? '请把相同颜色的物品连起来'
                      : step === 'playing'
                        ? selectedId !== null
                          ? '再选一个相同颜色的物品'
                          : '点击一个物品开始配对'
                        : feedbackText
                  }
                  speaking={step === 'prompting'}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {colorPalette.map((c) => (
                <div key={c.color} className="flex items-center gap-2">
                  <div
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-sm text-gray-500">{c.name}</span>
                </div>
              ))}
            </div>

            {/* Feedback */}
            {feedbackText && (
              <div
                className={`mt-6 animate-fade-in rounded-2xl px-6 py-4 text-center text-base font-medium shadow-md ${
                  step === 'correct'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-orange-50 text-orange-500'
                }`}
              >
                <p>{feedbackText}</p>
              </div>
            )}

            {/* Instruction */}
            {step === 'playing' && selectedId === null && (
              <p className="mt-6 text-sm text-gray-400">
                💡 点击一个彩色物品，再点击另一个相同颜色的物品进行配对
              </p>
            )}
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
        @keyframes lineDraw {
          0% { opacity: 0; stroke-dashoffset: 1000; }
          100% { opacity: 1; stroke-dashoffset: 0; }
        }
        .animate-line-draw {
          stroke-dasharray: 1000;
          animation: lineDraw 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default ColorLineGame
