import assert from 'node:assert/strict'
import { test } from 'node:test'
import { playPcmResponse } from '../src/api/pcmPlayback.js'
const flush = () => new Promise(resolve => setImmediate(resolve))
function context() {
  const sources = []
  const ctx = { currentTime: 0, state: 'running', destination: {},
    createBuffer(channels, size, rate) { const values = new Float32Array(size); return { duration: size / rate, values, getChannelData: () => values } },
    createBufferSource() { const source = { connect() {}, disconnect() {}, start(at) { this.at = at }, stop() { this.stopped = true } }; sources.push(source); return source },
  }
  return { ctx, sources }
}
test('PCM starts before download ends, preserves split samples, and waits for final audio to end', async () => {
  const { ctx, sources } = context()
  let control, finished = false
  const response = new Response(new ReadableStream({ start(c) { control = c } }))
  const controller = new AbortController()
  const playing = playPcmResponse(response, ctx, controller.signal, () => {}).then(() => { finished = true })
  control.enqueue(new Uint8Array([0,64,0]))
  await flush()
  assert.equal(sources.length, 1)
  assert.equal(sources[0].buffer.values[0], 0.5)
  assert.equal(finished, false)
  control.enqueue(new Uint8Array([128]))
  control.close()
  await flush()
  assert.equal(sources.length, 2)
  assert.equal(sources[1].buffer.values[0], -1)
  assert.ok(sources[1].at >= sources[0].at + sources[0].buffer.duration)
  sources[0].onended()
  await flush()
  assert.equal(finished, false)
  sources[1].onended()
  await playing
  assert.equal(finished, true)
})
test('cancelling a PCM stream stops all queued audio and rejects continuation', async () => {
  const { ctx, sources } = context()
  let control
  const response = new Response(new ReadableStream({ start(c) { control = c } }))
  const controller = new AbortController()
  const playing = playPcmResponse(response, ctx, controller.signal, () => {})
  const rejection = assert.rejects(playing)
  control.enqueue(new Uint8Array([1,0,2,0]))
  await flush()
  controller.abort()
  await rejection
  assert.equal(sources[0].stopped, true)
  assert.equal(sources[0].onended, null)
})
