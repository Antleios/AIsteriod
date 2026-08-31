import { reportSpeechActivity } from './gameActivity.js'
const recognitionErrors = {
  'not-allowed': '麦克风权限被拒绝，请在浏览器中允许麦克风访问后重试。',
  'service-not-allowed': '浏览器不允许使用语音识别服务，请检查浏览器设置。',
  'audio-capture': '无法使用麦克风，请检查设备连接或是否被其他应用占用。',
  network: '语音识别服务连接失败，请检查网络；已识别的文字会保留。',
  'no-speech': '没有识别到语音，请检查麦克风后重试，也可以直接输入文字。',
  'language-not-supported': '当前语音识别服务不支持中文，请更换支持中文的浏览器。',
}

/** One recording owns its callbacks; late events cannot overwrite a later draft. */
export function createVoiceInput({ Recognition, initialText = '', onText, onStatus, onError, onAutoSend }) {
  const recognition = new Recognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true

  let closed = false
  let stopping = false
  let receivedText = false
  let latestText = initialText
  let stopTimer
  let resultTimer
  let silenceTimer
  let ended = false

  function armSilenceTimer() {
    clearTimeout(silenceTimer)
    if (!onAutoSend || !receivedText || closed || stopping) return
    silenceTimer = setTimeout(() => {
      const text = latestText.trim()
      finish(true)
      if (text) onAutoSend(text)
    }, 2000)
  }

  function detach() {
    clearTimeout(stopTimer)
    clearTimeout(resultTimer)
    clearTimeout(silenceTimer)
    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.onspeechstart = null
    recognition.onspeechend = null
  }

  function finish(abort = false) {
    if (closed) return
    closed = true
    reportSpeechActivity(false)
    detach()
    if (abort) {
      try { recognition.abort() } catch { /* Already stopped. */ }
    }
    onText(latestText)
    onStatus('idle')
  }

  recognition.onstart = () => {
    if (!closed && !stopping) onStatus('listening')
  }
  recognition.onresult = (event) => {
    if (closed) return
    // Results contain the whole recording, including revised interim segments.
    const text = Array.from(event.results, (result) => result[0]?.transcript ?? '').join('')
    if (!text.trim()) return
    reportSpeechActivity()
    receivedText = true
    clearTimeout(resultTimer)
    latestText = initialText + text
    onText(latestText)
    onError('')
    armSilenceTimer()
  }
  recognition.onspeechstart = () => {
    reportSpeechActivity(true)
    clearTimeout(silenceTimer)
    silenceTimer = undefined
  }
  recognition.onspeechend = () => { reportSpeechActivity(false); armSilenceTimer() }
  recognition.onerror = (event) => {
    if (closed) return
    onError(recognitionErrors[event.error] ?? '语音识别中断，已识别的文字已保留，请重试或直接输入。')
    finish(true)
  }
  recognition.onend = () => {
    if (closed) return
    reportSpeechActivity(false)
    ended = true
    // Some browsers end recognition before our two-second pause has elapsed.
    // Keep the existing countdown rather than sending early or losing the text.
    if (onAutoSend && receivedText && !stopping) {
      onStatus('waiting')
      if (!silenceTimer) armSilenceTimer()
      return
    }
    if (!receivedText) onError(recognitionErrors['no-speech'])
    finish()
  }

  return {
    start() {
      onStatus('starting')
      try {
        recognition.start()
        if (closed) return
        resultTimer = setTimeout(() => {
          if (receivedText || closed) return
          onError('暂未收到识别文字，请检查麦克风和网络。可以停止录音后直接输入文字。')
        }, 12_000)
      } catch {
        onError('无法启动语音识别，请检查麦克风权限后重试。')
        finish(true)
      }
    },
    stop() {
      if (closed || stopping) return
      stopping = true
      clearTimeout(silenceTimer)
      clearTimeout(resultTimer)
      onStatus('stopping')
      if (ended) { finish(); return }
      // Allow the service to deliver a final result, but never wait forever for onend.
      stopTimer = setTimeout(() => finish(true), 2000)
      try { recognition.stop() } catch { finish(true) }
    },
    dispose() {
      reportSpeechActivity(false)
      closed = true
      detach()
      try { recognition.abort() } catch { /* Already stopped. */ }
    },
  }
}
