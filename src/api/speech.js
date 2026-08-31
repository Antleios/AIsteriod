import { getApiUrl } from './client.js'
import { playPcmResponse } from './pcmPlayback.js'

let active = null
let player = null
let audioContext = null
function getAudioContext() {
  const Context = window.AudioContext || window.webkitAudioContext
  if (Context) audioContext ??= new Context()
  return audioContext
}
let lastText = ''
let speechStatus = ''
const listeners = new Set()
const busyListeners = new Set()
const textListeners = new Set()
export function subscribeSpeechText(fn) { textListeners.add(fn); fn(active ? lastText : ''); return () => textListeners.delete(fn) }
function publishBusy() { busyListeners.forEach((fn) => fn(Boolean(active))) }
function publishStatus(value) { speechStatus = value; listeners.forEach((fn) => fn(value)) }
export function subscribeSpeechBusy(fn) { busyListeners.add(fn); fn(Boolean(active)); return () => busyListeners.delete(fn) }
export function subscribeSpeechStatus(fn) { listeners.add(fn); fn(speechStatus); return () => listeners.delete(fn) }
function getPlayer() { player ??= new Audio(); return player }

// Reuse a player unlocked by a real click, rather than creating one after fetch.
export function enableSpeech() {
  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume().catch(() => {})
  const audio = getPlayer()
  if (active?.resume) { active.resume(); return }
  if (active?.audio) return
  audio.src = 'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQEAAACA'
  audio.play()?.catch(() => {})
}

function release(job) {
  clearTimeout(job.timer)
  job.controller.abort()
  job.stopWaiting?.()
  job.resume = null
  if (job.audio) {
    job.audio.onended = null
    job.audio.onerror = null
    job.audio.onplaying = null
    job.audio.pause()
  }
  if (job.objectUrl) URL.revokeObjectURL(job.objectUrl)
  job.objectUrl = null
}

export function cancelSpeech() {
  const previous = active
  active = null
  if (previous) release(previous)
  window.speechSynthesis?.cancel()
  publishBusy()
}

export function replaySpeech() {
  if (active?.resume) { active.resume(); return }
  enableSpeech()
  if (lastText && !active) speakGentle(lastText)
}
export function skipSpeech() { active?.finish('skipped', '已跳过本次语音，可以继续。') }

export function speakGentle(text, onEnd, onStart) {
  cancelSpeech()
  lastText = String(text)
  const spokenText = lastText
  textListeners.forEach((fn) => fn(spokenText))
  const job = { controller: new AbortController(), timer: null, audio: null, objectUrl: null, resume: null }
  active = job
  publishBusy()
  const current = () => active === job
  let started = false
  const markStarted = () => { if (current() && !started) { started = true; onStart?.() } }
  job.finish = (outcome = 'ended', message) => {
    if (!current()) return
    active = null
    release(job)
    window.speechSynthesis?.cancel()
    if (message) publishStatus(message)
    publishBusy()
    onEnd?.({ outcome })
  }

  const local = (message) => {
    if (!current()) return
    publishStatus(message)
    try {
      if (!window.speechSynthesis) { job.finish('failed', '此浏览器无法播放语音，请点击“播放语音”重试。'); return }
      const utterance = new SpeechSynthesisUtterance(spokenText)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.85
      utterance.pitch = 1
      utterance.volume = 0.85
      const voices = window.speechSynthesis.getVoices().filter((voice) => /^zh[-_]CN/i.test(voice.lang))
      const voice = voices.find((item) => /Xiaoxiao|Xiaoyi|Natural|自然/i.test(item.name)) ?? voices[0]
      if (voice) utterance.voice = voice
      utterance.onend = () => job.finish('ended', '浏览器语音播放完成')
      utterance.onerror = () => job.finish('failed', '浏览器未能播放语音，请点击“播放语音”重试。')
      job.timer = setTimeout(() => job.finish('failed', '语音未能开始播放，已解除等待。'), 5000)
      utterance.onstart = () => {
        if (!current()) return
        markStarted()
        clearTimeout(job.timer)
        job.timer = setTimeout(() => job.finish('failed', '语音播放超时，已解除等待。'), Math.max(15_000, Math.min(180_000, spokenText.length * 600)))
      }
      window.speechSynthesis.speak(utterance)
    } catch { job.finish('failed', '浏览器语音不可用，已解除等待。') }
  }

  async function playAudio(blob, length) {
    const audio = getPlayer()
    job.audio = audio
    job.objectUrl = URL.createObjectURL(blob)
    audio.src = job.objectUrl
    audio.volume = 1
    audio.muted = false
    await new Promise((resolve, reject) => {
      let settled = false
      const settle = (error) => {
        if (settled) return
        settled = true
        clearTimeout(job.timer)
        job.resume = null
        job.stopWaiting = null
        error ? reject(error) : resolve()
      }
      job.stopWaiting = () => settle(new Error('Playback cancelled'))
      audio.onended = () => settle()
      audio.onerror = () => settle(new Error('Audio decoding failed'))
      audio.onplaying = () => {
        markStarted()
        clearTimeout(job.timer)
        publishStatus('正在播放云端语音')
        job.timer = setTimeout(() => settle(new Error('Playback timed out')), Math.max(15_000, Math.min(180_000, length * 600)))
      }
      const start = () => {
        if (!current()) return
        clearTimeout(job.timer)
        job.timer = setTimeout(() => settle(new Error('Audio did not start')), 8000)
        try {
          Promise.resolve(audio.play()).catch((error) => {
            if (!current()) return
            if (error.name === 'NotAllowedError') {
              publishStatus('浏览器阻止了自动播放，请点击“播放语音”。')
              job.resume = start
              clearTimeout(job.timer)
              job.timer = setTimeout(() => settle(error), 12_000)
            } else settle(error)
          })
        } catch (error) { settle(error) }
      }
      start()
    })
    audio.onended = null
    audio.onerror = null
    audio.onplaying = null
    URL.revokeObjectURL(job.objectUrl)
    job.objectUrl = null
  }

  const play = async () => {
    try {
      for (const chunk of spokenText.match(/[\s\S]{1,400}/gu) ?? []) {
        publishStatus('正在生成语音…')
        // Settle independently even if a browser/network ignores AbortSignal.
        const blob = await new Promise((resolve, reject) => {
          job.timer = setTimeout(() => { job.controller.abort(); reject(new Error('Speech request timed out')) }, 35_000)
          fetch(getApiUrl('/api/ai/speech'), {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunk, stream: Boolean(window.AudioContext || window.webkitAudioContext) }), signal: job.controller.signal,
          }).then(async (result) => {
            if (!result.ok) throw new Error('Speech service unavailable')
            if (result.headers.get('content-type')?.startsWith('audio/pcm')) return result
            if (result.headers.get('content-type')?.includes('application/json')) {
              const data = await result.json()
              if (data.provider === 'browser') return null
              throw new Error('Unexpected speech response')
            }
            const data = await result.blob()
            if (!data.size || !data.type.startsWith('audio/')) throw new Error('Empty or invalid audio')
            return data
          }).then(resolve, reject)
        })
        if (!current()) return
        clearTimeout(job.timer)
        if (!blob) { local('正在使用浏览器语音'); return }
        if (blob.headers?.get('content-type')?.startsWith('audio/pcm')) {
          const context = getAudioContext()
          if (!context) throw new Error('Web Audio unavailable')
          if (context.state !== 'running') {
            publishStatus('请点击“播放语音”开启声音。')
            await new Promise((resolve, reject) => {
              job.timer = setTimeout(() => reject(new Error('Audio context blocked')), 12000)
              job.stopWaiting = () => reject(new Error('Playback cancelled'))
              job.resume = () => { void context.resume().then(() => { if (context.state === 'running') resolve() }, reject) }
              job.resume()
            })
            clearTimeout(job.timer)
            job.resume = null
            job.stopWaiting = null
          }
          if (!current()) return
          job.timer = setTimeout(() => job.controller.abort(), Math.max(60_000, Math.min(180_000, chunk.length * 600)))
          await playPcmResponse(blob, context, job.controller.signal, () => {
            markStarted()
            publishStatus('正在流式播放语音')
          })
          clearTimeout(job.timer)
          if (!current()) return
          continue
        }
        await playAudio(blob, chunk.length)
        if (!current()) return
      }
      job.finish('ended', '云端语音播放完成')
    } catch {
      if (!current()) return
      job.controller.abort()
      clearTimeout(job.timer)
      if (job.audio) { job.audio.onended = null; job.audio.onerror = null; job.audio.onplaying = null; job.audio.pause() }
      local('云端语音不可用，正在尝试浏览器语音…')
    }
  }
  void play()
  return () => { if (current()) cancelSpeech() }
}
