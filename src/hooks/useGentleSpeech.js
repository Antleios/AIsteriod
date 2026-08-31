import { useCallback, useEffect, useRef, useState } from 'react'
import { speakGentle, subscribeSpeechBusy, subscribeSpeechStatus, subscribeSpeechText } from '../api/speech.js'

export function useSpeechText() {
  const [text, setText] = useState('')
  useEffect(() => subscribeSpeechText(setText), [])
  return text
}

export function useGentleSpeech() {
  const cancelRef = useRef(null)
  useEffect(() => () => cancelRef.current?.(), [])
  return useCallback((text, onEnd, onStart) => { cancelRef.current = speakGentle(text, onEnd, onStart) }, [])
}

export function useSpeechBusy() {
  const [busy, setBusy] = useState(false)
  useEffect(() => subscribeSpeechBusy(setBusy), [])
  return busy
}

export function useSpeechStatus() {
  const [status, setStatus] = useState('')
  useEffect(() => subscribeSpeechStatus(setStatus), [])
  return status
}
