import { useState, useEffect } from 'react'
import aiLogo from '../assets/logo.jpg'
import { useSpeechBusy, useSpeechText } from '../hooks/useGentleSpeech.js'

function AIAvatar({ message: fallbackMessage }) {
  const spokenText = useSpeechText()
  const speaking = useSpeechBusy()
  const message = spokenText || fallbackMessage
  const [dotCount, setDotCount] = useState(0)

  useEffect(() => {
    if (!speaking) return
    const timer = setInterval(() => {
      setDotCount((c) => (c + 1) % 4)
    }, 500)
    return () => clearInterval(timer)
  }, [speaking])

  return (
    <div className="flex items-end gap-3">
      {/* AI Avatar */}
      <div
        className={`flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-lg transition-all duration-300 ${
          speaking ? 'scale-110 shadow-[#3B82F6]/40' : ''
        }`}
      >
        <img src={aiLogo} alt="AI" className="h-full w-full object-cover" />
      </div>

      {/* Speech Bubble */}
      <div
        className={`relative max-w-[260px] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md transition-all duration-300 ${
          speaking
            ? 'rounded-bl-md bg-[#3B82F6] text-white'
            : 'rounded-bl-2xl bg-white text-gray-700'
        }`}
      >
        {speaking ? (
          <span>
            {message}
            <span className="inline-block w-4 text-left">
              {'.'.repeat(dotCount)}
            </span>
          </span>
        ) : (
          message
        )}
        {/* Triangle tail */}
        <div
          className={`absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 ${
            speaking ? 'bg-[#3B82F6]' : 'bg-white'
          }`}
        />
      </div>
    </div>
  )
}

export default AIAvatar
