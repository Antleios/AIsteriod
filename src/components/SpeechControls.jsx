import { useEffect } from 'react'
import { enableSpeech, replaySpeech, skipSpeech } from '../api/speech.js'
import { useSpeechBusy, useSpeechStatus } from '../hooks/useGentleSpeech.js'

export default function SpeechControls() {
  const busy = useSpeechBusy()
  const status = useSpeechStatus()
  useEffect(() => {
    const unlock = () => { try { enableSpeech() } catch { /* Playback button remains available. */ } }
    window.addEventListener('pointerdown', unlock, { capture: true })
    return () => window.removeEventListener('pointerdown', unlock, { capture: true })
  }, [])
  return <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3 px-4 py-2 text-xs text-gray-500">
    <span role="status">{status || '语音已就绪'}</span>
    <button type="button" onClick={replaySpeech} className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">播放语音</button>
    {busy && <button type="button" onClick={skipSpeech} className="rounded-full bg-gray-100 px-3 py-2">跳过本次语音</button>}
  </div>
}
