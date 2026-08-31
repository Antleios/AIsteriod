import { useEffect, useRef } from 'react'
import { recordTrainingEvents } from '../api/training.js'
import { subscribeSpeechBusy } from '../api/speech.js'

export function useTrainingIdleTracker(gameRunId, { conversationRef, paused = false, questionId } = {}) {
  const options = useRef({ conversationRef, paused, questionId })
  useEffect(() => { options.current = { conversationRef, paused, questionId } }, [conversationRef, paused, questionId])
  useEffect(() => startTrainingIdleTracker(gameRunId, options), [gameRunId])
}

export function startTrainingIdleTracker(gameRunId, options, recordEvents = recordTrainingEvents, subscribeBusy = subscribeSpeechBusy) {
    if (!gameRunId) return
    let lastActivity = Date.now()
    let reported = false
    let speaking = false
    let audioBusy = false
    let requesting = false
    let pendingWrong = null
    let disposed = false
    const activity = () => { lastActivity = Date.now(); reported = false }
    const speech = (event) => {
      if (event.detail?.speaking !== false || speaking) activity()
      if (typeof event.detail?.speaking === 'boolean') speaking = event.detail.speaking
    }
    const wrong = (event) => {
      if (event.detail.gameRunId === gameRunId) pendingWrong = event.detail
    }
    const unsubscribe = subscribeBusy((busy) => { audioBusy = busy; lastActivity = Date.now() })
    const check = async () => {
      if (disposed) return
      if (document.hidden || options.current.paused || audioBusy || speaking || requesting) { lastActivity = Date.now(); return }
      const panel = options.current.conversationRef?.current
      if (!panel) return
      const idleDurationMs = Date.now() - lastActivity
      if (!pendingWrong && (reported || idleDurationMs < 5000)) return
      if (pendingWrong && options.current.questionId && pendingWrong.questionId !== options.current.questionId) { pendingWrong = null; return }
      const trigger = pendingWrong ? 'MULTIPLE_WRONG' : 'LONG_IDLE'
      const targetQuestion = pendingWrong?.questionId ?? options.current.questionId
      pendingWrong = null
      reported = true
      requesting = true
      try {
        if (trigger === 'LONG_IDLE') void recordEvents([{ type: trigger, gameRunId, data: { idleDurationMs } }]).catch(() => {})
        await panel.nudge(trigger, targetQuestion)
      } catch { /* The panel reports API errors; do not retry in a tight loop. */ }
      finally { requesting = false; lastActivity = Date.now() }
    }
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach(event => window.addEventListener(event, activity, { passive: true }))
    window.addEventListener('game-speech-activity', speech)
    window.addEventListener('game-multiple-wrong', wrong)
    document.addEventListener('visibilitychange', activity)
    const interval = window.setInterval(() => { void check() }, 250)
    return () => {
      disposed = true
      clearInterval(interval)
      unsubscribe()
      events.forEach(event => window.removeEventListener(event, activity))
      window.removeEventListener('game-speech-activity', speech)
      window.removeEventListener('game-multiple-wrong', wrong)
      document.removeEventListener('visibilitychange', activity)
    }
}
