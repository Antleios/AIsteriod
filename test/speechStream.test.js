import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openSpeechStream, decodeSpeechEvents } from '../server/src/services/speechStreamService.js'
const encoder = new TextEncoder()
const frame = (data, stop = false) => `data:${JSON.stringify({ output: { audio: { data }, finish_reason: stop ? 'stop' : null } })}\r\n\r\n`
const collect = async iterable => { const chunks = []; for await (const chunk of iterable) chunks.push(chunk); return Buffer.concat(chunks) }

test('SSE handles split boundaries and returns PCM before the final event', async () => {
  let control
  const stream = new ReadableStream({ start(c) { control = c } })
  const iterator = decodeSpeechEvents(stream)
  const first = iterator.next()
  const event = encoder.encode(frame('AQACAAMABA=='))
  control.enqueue(event.slice(0, 17)); control.enqueue(event.slice(17))
  assert.deepEqual((await first).value, Buffer.from([1,0,2,0,3,0,4]))
  control.enqueue(encoder.encode(frame('', true))); control.close()
  assert.equal((await iterator.next()).done, true)
})

test('cache reuses only fixed phrases and invalidates for voice changes; truncated streams are never cached', async t => {
  const prior = { key: process.env.QWEN_API_KEY, provider: process.env.TTS_PROVIDER, voice: process.env.QWEN_TTS_VOICE }
  process.env.QWEN_API_KEY = 'test-key'; process.env.TTS_PROVIDER = 'qwen'; process.env.QWEN_TTS_VOICE = 'test-voice-a'
  t.after(() => { for (const [key, value] of Object.entries({ QWEN_API_KEY: prior.key, TTS_PROVIDER: prior.provider, QWEN_TTS_VOICE: prior.voice })) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  let calls = 0, truncated = false
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++
    assert.equal(options.headers['X-DashScope-SSE'], 'enable')
    return new Response(frame('AQACAAMA') + (truncated ? '' : frame('', true)), { headers: { 'Content-Type': 'text/event-stream' } })
  })
  const fixed = '请说出图片上的物品名称'
  let result = await openSpeechStream(fixed); assert.equal(result.cache, 'MISS'); await collect(result.chunks)
  result = await openSpeechStream(fixed); assert.equal(result.cache, 'HIT'); assert.equal((await collect(result.chunks)).length, 6)
  assert.equal(calls, 1)
  for (let i = 0; i < 2; i++) { result = await openSpeechStream('一段患者私人对话'); assert.equal(result.cache, 'BYPASS'); await collect(result.chunks) }
  assert.equal(calls, 3)
  process.env.QWEN_TTS_VOICE = 'test-voice-b'; truncated = true
  result = await openSpeechStream(fixed); assert.equal(result.cache, 'MISS'); await assert.rejects(collect(result.chunks), /Incomplete/)
  truncated = false
  result = await openSpeechStream(fixed); assert.equal(result.cache, 'MISS'); await collect(result.chunks)
  assert.equal(calls, 5)
})
