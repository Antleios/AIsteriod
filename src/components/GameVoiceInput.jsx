import { useEffect, useRef, useState } from 'react'
import { createVoiceInput } from '../api/voiceInput.js'
import { cancelSpeech } from '../api/speech.js'

// The single microphone for a game lives outside its text conversation panel.
export default function GameVoiceInput({ onSend, onActivity, disabled }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const voice = useRef(null)
  const send = useRef(onSend)
  useEffect(() => { send.current = onSend }, [onSend])
  useEffect(() => { onActivity(status !== 'idle'); return () => onActivity(false) }, [status, onActivity])
  useEffect(() => () => voice.current?.dispose(), [])
  useEffect(() => {
    const stop = () => voice.current?.stop()
    window.addEventListener('game-proactive-reply', stop)
    return () => window.removeEventListener('game-proactive-reply', stop)
  }, [])
  const toggle = () => {
    if (status !== 'idle') { voice.current?.stop(); return }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition || !window.isSecureContext) { setError('当前环境不支持语音识别，可以在下方输入文字。'); return }
    cancelSpeech()
    voice.current?.dispose()
    voice.current = createVoiceInput({
      Recognition, initialText: text, onText: setText, onStatus: setStatus, onError: setError,
      onAutoSend: async (content) => {
        const sent = await send.current(content)
        if (sent !== false) setText('')
      },
    })
    voice.current.start()
  }
  return <div className="my-5 flex flex-col items-center gap-2">
    <button type="button" aria-label="游戏语音输入" onClick={toggle} disabled={disabled || status === 'stopping'} className={`rounded-2xl px-8 py-4 text-lg shadow disabled:opacity-40 ${status === 'idle' ? 'bg-white text-blue-600' : 'bg-red-100 text-red-500'}`}>
      {status === 'idle' ? '🎤 点击说话' : '🔴 停止并保留文字'}
    </button>
    {(status !== 'idle' || text || error) && <form className="animate-fade-in flex w-full max-w-xl gap-3" onSubmit={async (event) => {
      event.preventDefault()
      if (disabled || status !== 'idle' || !text.trim()) return
      if (await send.current(text, 'TEXT') !== false) setText('')
    }}>
      <input aria-label="游戏消息" value={text} readOnly={status !== 'idle' || disabled} onChange={(event) => setText(event.target.value)} placeholder="说话后文字会显示在这里，也可以输入想说的话…" className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white/80 px-5 py-3 text-sm outline-none focus:border-blue-500" />
      <button disabled={disabled || status !== 'idle' || !text.trim()} className="rounded-2xl bg-blue-500 px-6 py-3 text-sm text-white disabled:opacity-40">发送</button>
    </form>}
    <p className="text-xs text-gray-500">停顿 2 秒自动发送，想要提示或觉得困难都可以说。</p>
    {error && <p role="alert" className="text-xs text-orange-700">{error}</p>}
  </div>
}
