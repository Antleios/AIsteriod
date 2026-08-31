import { useCallback } from 'react'
import { useGentleSpeech } from './useGentleSpeech.js'

// Record fixed game speech as well as API replies, without treating it as an AI request.
export function useGameSpeech(conversationRef) {
  const speak = useGentleSpeech()
  return useCallback((text, onEnd) => {
    speak(text, onEnd, () => conversationRef.current?.record('assistant', text))
  }, [conversationRef, speak])
}
