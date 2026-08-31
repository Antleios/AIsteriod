import assert from 'node:assert/strict'
import { test } from 'node:test'
let id = 0
async function environment(t, cloud = true) {
  const speech = await import('../src/api/speech.js?test=' + id++)
  const previous = { window: globalThis.window, Audio: globalThis.Audio, SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance }
  const audio = []
  const local = []
  globalThis.window = { speechSynthesis: { cancel() {}, getVoices: () => [], speak: (utterance) => local.push(utterance) } }
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  globalThis.Audio = class {
    constructor() { audio.push(this) }
    play() { this.onplaying?.(); return Promise.resolve() }
    pause() { this.paused = true }
  }
  t.mock.method(globalThis, 'fetch', async () => cloud
    ? new Response(new Uint8Array(44), { headers: { 'Content-Type': 'audio/wav' } })
    : new Response(JSON.stringify({ error: { message: 'not configured' } }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
  t.after(() => {
    speech.cancelSpeech()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value
    }
  })
  return { audio, local, ...speech }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))

test('only speech that actually starts is recorded, once per utterance', async (t) => {
  const s = await environment(t)
  const recorded = []
  s.speakGentle('已被替换的开场白', undefined, () => recorded.push('old'))
  s.speakGentle('实际播放的开场白', undefined, () => recorded.push('current'))
  await flush()
  s.audio[0].onplaying()
  assert.deepEqual(recorded, ['current'])
  s.audio[0].onended()
  await flush()
  assert.deepEqual(recorded, ['current'])
})

test('binary audio stays busy until playback ends and continuation runs once', async (t) => {
  const s = await environment(t)
  const busy = []
  t.after(s.subscribeSpeechBusy(value => busy.push(value)))
  let finished = 0
  s.speakGentle('我们慢慢来', () => finished++)
  await flush()
  assert.equal(s.audio.length, 1)
  assert.match(s.audio[0].src, /^blob:/)
  assert.equal(busy.at(-1), true)
  s.audio[0].onended()
  await flush()
  assert.equal(finished, 1)
  assert.equal(busy.at(-1), false)
})

test('cancelling old playback does not cancel the reused player owned by a new job', async (t) => {
  const s = await environment(t)
  let finished = 0
  const cancelOld = s.speakGentle('上一条', () => finished++)
  await flush()
  s.speakGentle('新一条')
  await flush()
  cancelOld()
  assert.equal(s.audio.length, 1)
  assert.equal(typeof s.audio[0].onended, 'function')
  s.cancelSpeech()
  assert.equal(s.audio[0].onended, null)
  assert.equal(finished, 0)
})

test('cloud failure uses slower local speech and completes the continuation', async (t) => {
  const s = await environment(t, false)
  let finished = false
  s.speakGentle('可以慢慢想', () => { finished = true })
  await flush()
  assert.equal(s.local[0].rate, 0.85)
  s.local[0].onend()
  assert.equal(finished, true)
})

test('an unexpected AbortError still falls back and releases the game wait', async (t) => {
  const s = await environment(t)
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('network aborted', 'AbortError') })
  let finished = false
  s.speakGentle('你好', () => { finished = true })
  await flush()
  assert.equal(s.local.length, 1)
  s.local[0].onerror()
  assert.equal(finished, true)
})

test('local speech throwing cannot leave global busy true', async (t) => {
  const s = await environment(t, false)
  window.speechSynthesis.speak = () => { throw new Error('device failure') }
  const busy = []
  t.after(s.subscribeSpeechBusy(value => busy.push(value)))
  let outcome
  s.speakGentle('你好', (result) => { outcome = result.outcome })
  await flush()
  assert.equal(outcome, 'failed')
  assert.equal(busy.at(-1), false)
})

test('blocked autoplay can resume from a user click without a second API request', async (t) => {
  const s = await environment(t)
  let blocked = true
  globalThis.Audio.prototype.play = function () {
    if (blocked) return Promise.reject(new DOMException('gesture required', 'NotAllowedError'))
    this.onplaying?.(); return Promise.resolve()
  }
  let finished = 0
  s.speakGentle('你好', () => finished++)
  await flush()
  assert.equal(finished, 0)
  blocked = false
  s.replaySpeech()
  s.audio[0].onended()
  await flush()
  assert.equal(finished, 1)
  assert.equal(s.audio.length, 1)
})

test('no local start callback times out and releases the wait', async (t) => {
  const s = await environment(t, false)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let outcome
  s.speakGentle('你好', (result) => { outcome = result.outcome })
  await flush()
  t.mock.timers.tick(5000)
  assert.equal(outcome, 'failed')
})

test('a request ignoring AbortSignal still times out and does not block forever', async (t) => {
  const s = await environment(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(globalThis, 'fetch', () => new Promise(() => {}))
  let outcome
  s.speakGentle('你好', result => { outcome = result.outcome })
  t.mock.timers.tick(35000)
  await flush()
  assert.equal(s.local.length, 1)
  t.mock.timers.tick(5000)
  assert.equal(outcome, 'failed')
})
