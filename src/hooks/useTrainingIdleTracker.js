import { useEffect, useRef } from 'react'
import { recordTrainingEvents } from '../api/training.js'

const LONG_IDLE_MS = 30_000
const CHECK_INTERVAL_MS = 5_000

/** Records one long-idle event for each uninterrupted inactive period. */
export function useTrainingIdleTracker(gameRunId) {
  const lastActivityAtRef = useRef(0)
  const reportedRef = useRef(false)

  useEffect(() => {
    if (!gameRunId) return undefined

    const registerActivity = () => {
      lastActivityAtRef.current = Date.now()
      reportedRef.current = false
    }
    const checkIdle = () => {
      const idleDurationMs = Date.now() - lastActivityAtRef.current
      if (reportedRef.current || idleDurationMs < LONG_IDLE_MS) return
      reportedRef.current = true
      recordTrainingEvents([
        { type: 'LONG_IDLE', gameRunId, data: { idleDurationMs } },
      ]).catch(() => {})
    }

    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, registerActivity, { passive: true }))
    const interval = window.setInterval(checkIdle, CHECK_INTERVAL_MS)
    registerActivity()

    return () => {
      events.forEach((event) => window.removeEventListener(event, registerActivity))
      window.clearInterval(interval)
    }
  }, [gameRunId])
}
