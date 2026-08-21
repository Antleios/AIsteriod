import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar.jsx'
import AIAvatar from '../components/AIAvatar.jsx'
import RewardPopup from '../components/RewardPopup.jsx'
import { fetchColorLineRoundConfig } from '../api/games.js'
import { generateColorRound, colorPalette } from '../data/colorItems.js'

const DEFAULT_DAILY_GOAL = 5
const DEFAULT_TOTAL_PAIRS = 5

function ColorLineGame() {
  const navigate = useNavigate()
  const boardRef = useRef(null)
  const svgRef = useRef(null)

  /* ── state ── */
  const [score, setScore] = useState(0)
  const [todayCompleted, setTodayCompleted] = useState(0)
  const [roundConfig, setRoundConfig] = useState({
    dailyGoal: DEFAULT_DAILY_GOAL,
    totalPairs: DEFAULT_TOTAL_PAIRS,
    palette: colorPalette,
  })
  const [items, setItems] = useState(() => generateColorRound())
  const [matches, setMatches] = useState([])
  const [step, setStep] = useState('prompting')
  const [feedbackText, setFeedbackText] = useState('')
  const [showReward, setShowReward] = useState(false)
  const [roundKey, setRoundKey] = useState(0)

  /* ── ref for current matched IDs (always up-to-date inside closures) ── */
  const matchedIdsRef = useRef(new Set())
  useEffect(() => {
    matchedIdsRef.current = new Set(matches.flatMap((m) => [m.id1, m.id2]))
  }, [matches])

  /* ── drag state ── */
  const [dragging, setDragging] = useState(false)
  const [dragFromId, setDragFromId] = useState(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [dropTargetId, setDropTargetId] = useState(null)
  const dragFromIdRef = useRef(null)
  const dragStartPosRef = useRef({ x: 0, y: 0 }) // for detecting actual drag movement

  useEffect(() => {
    let cancelled = false

    fetchColorLineRoundConfig()
      .then((config) => {
        if (cancelled) return
        const palette = config.palette.length ? config.palette : colorPalette
        setRoundConfig({
          dailyGoal: config.dailyGoal,
          totalPairs: config.totalPairs,
          palette,
        })
        setItems(generateColorRound(palette))
        setMatches([])
        setRoundKey((key) => key + 1)
      })
      .catch(() => {
        setRoundConfig({
          dailyGoal: DEFAULT_DAILY_GOAL,
          totalPairs: DEFAULT_TOTAL_PAIRS,
          palette: colorPalette,
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const speak = useCallback((t) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(t)
    u.lang = 'zh-CN'; u.rate = 0.9
    window.speechSynthesis.speak(u)
  }, [])

  /* ── init round ── */
  useEffect(() => {
    setStep('prompting')
    speak('请把相同颜色的物品连起来')
    const t = setTimeout(() => setStep('playing'), 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey])

  const matchedIds = new Set(matches.flatMap((m) => [m.id1, m.id2]))

  /* ── document-level drag listeners ── */
  useEffect(() => {
    if (!dragging) return

    const svgEl = svgRef.current
    if (!svgEl) return

    const onMove = (e) => {
      const r = svgEl.getBoundingClientRect()
      setDragPos({ x: e.clientX - r.left, y: e.clientY - r.top })

      // hit-test using elementFromPoint
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const itemEl = el?.closest('[data-item-id]')
      const id = itemEl ? Number(itemEl.getAttribute('data-item-id')) : null
      setDropTargetId((prev) => (prev !== id ? id : prev))
    }

    const onUp = (e) => {
      const fromId = dragFromIdRef.current
      setDragging(false)
      setDragFromId(null)
      setDropTargetId(null)
      setDragPos({ x: 0, y: 0 })

      const el = document.elementFromPoint(e.clientX, e.clientY)
      const itemEl = el?.closest('[data-item-id]')
      const targetId = itemEl ? Number(itemEl.getAttribute('data-item-id')) : null

      if (targetId === null || targetId === fromId) return // cancel

      // only count as a match attempt if the pointer actually moved (real drag)
      const dx = e.clientX - dragStartPosRef.current.x
      const dy = e.clientY - dragStartPosRef.current.y
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return

      const from = items.find((i) => i.id === fromId)
      const target = items.find((i) => i.id === targetId)
      if (!from || !target) return

      // prevent re-matching already-paired items
      if (matchedIdsRef.current.has(from.id) || matchedIdsRef.current.has(target.id)) return

      if (from.color === target.color) {
        // ✅ Correct
        setMatches((prev) => {
          const next = [...prev, { id1: from.id, id2: target.id, color: from.color }]
          return next
        })
        setStep('correct')
        setFeedbackText(`太棒了！${from.label}配对成功！🎉`)
        speak(`${from.label}配对成功！`)
        setScore((s) => s + 1)
        setShowReward(true)
        setTodayCompleted((n) => n + 1)
      } else {
        // ❌ Wrong
        setStep('wrong')
        setFeedbackText(`这两个颜色不一样哦，再试试吧🤔`)
        speak('颜色不一样，再试试吧')
        setTimeout(() => {
          setStep('playing')
          setFeedbackText('')
        }, 1800)
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)

    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  /* ── item pointer down ── */
  const handlePointerDown = (e, item) => {
    if (step !== 'playing' || matchedIds.has(item.id)) return
    e.preventDefault()
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    setDragging(true)
    setDragFromId(item.id)
    dragFromIdRef.current = item.id
    dragStartPosRef.current = { x: e.clientX, y: e.clientY }
    setDragPos({ x: e.clientX - r.left, y: e.clientY - r.top })
    speak(`选中了${item.label}`)
  }

  /* ── auto-advance after correct ── */
  useEffect(() => {
    if (step === 'correct' && matches.length < roundConfig.totalPairs) {
      const t = setTimeout(() => { setStep('playing'); setFeedbackText('') }, 1800)
      return () => clearTimeout(t)
    }
  }, [roundConfig.totalPairs, step, matches.length])

  useEffect(() => {
    if (matches.length === roundConfig.totalPairs && step === 'correct') {
      const t = setTimeout(() => { setStep('complete'); setFeedbackText('') }, 1200)
      return () => clearTimeout(t)
    }
  }, [matches.length, roundConfig.totalPairs, step])

  const nextRound = () => {
    setItems(generateColorRound(roundConfig.palette))
    setMatches([])
    setStep('prompting')
    setRoundKey((k) => k + 1)
  }

  const isAllDone = todayCompleted >= roundConfig.dailyGoal

  /* ── SVG line: get item center in SVG coords ── */
  const getSvgCenter = (itemId) => {
    const el = boardRef.current?.querySelector(`[data-item-id="${itemId}"]`)
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!el || !svgRect) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2 - svgRect.left, y: r.top + r.height / 2 - svgRect.top }
  }

  /* ── render ── */
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#EAF4FF] via-white to-[#EAF4FF]/60">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button onClick={() => navigate('/patient/games')}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-[#3B82F6]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <h1 className="text-2xl font-bold text-[#3B82F6]">颜色连线游戏</h1>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>⭐</span>
          <span className="font-semibold text-yellow-500">{score}</span>
        </div>
      </div>

      <div className="mx-6 mb-4">
        <ProgressBar current={todayCompleted} total={roundConfig.dailyGoal} />
      </div>

      <main className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-12">
        {isAllDone ? (
          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="text-8xl">🎉</div>
            <h2 className="text-3xl font-bold text-[#3B82F6]">今日全部完成！</h2>
            <p className="text-gray-500">今天完成了 {roundConfig.dailyGoal} 对颜色配对！</p>
            <button onClick={() => navigate('/')}
              className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-medium text-white shadow-lg transition-all hover:bg-[#2563EB]"
            >返回首页</button>
          </div>
        ) : step === 'complete' ? (
          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="text-8xl">🎉</div>
            <h2 className="text-3xl font-bold text-[#3B82F6]">全部配对成功！</h2>
            <p className="text-gray-500">你成功匹配了所有 {roundConfig.totalPairs} 对！</p>
            <button onClick={nextRound}
              className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-medium text-white shadow-lg transition-all hover:bg-[#2563EB]"
            >下一轮</button>
          </div>
        ) : (
          <>
            <div ref={boardRef} className="relative mt-4 w-full max-w-3xl select-none touch-none">
              <div className="relative aspect-[5/3] w-full rounded-3xl bg-white/70 shadow-lg backdrop-blur-sm overflow-hidden">
                {/* SVG overlay (pixel coords) */}
                <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full">
                  {/* Completed match lines */}
                  {matches.map((m, i) => {
                    const a = items.find((it) => it.id === m.id1)
                    const b = items.find((it) => it.id === m.id2)
                    if (!a || !b) return null
                    const p1 = getSvgCenter(m.id1)
                    const p2 = getSvgCenter(m.id2)
                    if (!p1 || !p2) return null
                    return (
                      <g key={i}>
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                          stroke={m.color} strokeWidth="4" strokeLinecap="round"
                        />
                        <circle cx={(p1.x + p2.x) / 2} cy={(p1.y + p2.y) / 2} r="6" fill={m.color} opacity="0.7">
                          <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    )
                  })}

                  {/* Active drag line */}
                  {dragging && dragFromId !== null && (() => {
                    const from = getSvgCenter(dragFromId)
                    if (!from) return null
                    const to = dropTargetId !== null ? getSvgCenter(dropTargetId) : dragPos
                    const fi = items.find(i => i.id === dragFromId)
                    return (
                      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={fi?.color || '#999'} strokeWidth="3"
                        strokeLinecap="round" strokeDasharray="8 4" opacity="0.7"
                      />
                    )
                  })()}
                </svg>

                {/* Items */}
                {items.map((item) => {
                  const matched = matchedIds.has(item.id)
                  const isDragSource = dragFromId === item.id
                  const isDropTarget = dropTargetId === item.id
                  const pctW = 82; const pctH = 70; const padX = 9; const padY = 15
                  const left = padX + (item.x / 100) * pctW
                  const top = padY + (item.y / 100) * pctH

                  return (
                    <button
                      key={item.id}
                      data-item-id={item.id}
                      onPointerDown={(e) => handlePointerDown(e, item)}
                      disabled={matched || step !== 'playing'}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                        matched
                          ? 'scale-90 opacity-40 cursor-default'
                          : isDragSource
                            ? 'scale-125 z-30 cursor-grabbing'
                            : isDropTarget
                              ? 'scale-125 z-20'
                              : step === 'playing' && !dragging
                                ? 'hover:scale-110 cursor-grab'
                                : 'cursor-default'
                      }`}
                      style={{ left: `${left}%`, top: `${top}%` }}
                    >
                      <div
                        className={`flex items-center justify-center ${
                          item.shape === 'circle' ? 'h-14 w-14 rounded-full' : 'h-12 w-12 rounded-xl'
                        } text-white text-xs font-bold shadow-lg transition-all duration-300 ${
                          isDragSource
                            ? 'ring-4 ring-white ring-offset-2 ring-offset-[#3B82F6]/30 shadow-xl'
                            : isDropTarget
                              ? 'ring-3 ring-white ring-offset-1 shadow-xl'
                              : ''
                        }`}
                        style={{
                          backgroundColor: item.color,
                          boxShadow: isDropTarget ? `0 0 20px ${item.color}80` : undefined,
                        }}
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
                      : dragging
                        ? '拖到相同颜色的物品上'
                        : step === 'playing'
                          ? '按住一个物品，拖到相同颜色的上面'
                          : feedbackText
                  }
                  speaking={step === 'prompting'}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {roundConfig.palette.map((c) => (
                <div key={c.color} className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-sm text-gray-500">{c.name}</span>
                </div>
              ))}
            </div>

            {/* Feedback */}
            {feedbackText && (
              <div className={`mt-6 animate-fade-in rounded-2xl px-6 py-4 text-center text-base font-medium shadow-md ${
                step === 'correct' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
              }`}>
                <p>{feedbackText}</p>
              </div>
            )}

            {step === 'playing' && !dragging && (
              <p className="mt-6 text-sm text-gray-400">
                💡 按住一个彩色物品，拖到另一个相同颜色的物品上即可配对
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
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  )
}

export default ColorLineGame
