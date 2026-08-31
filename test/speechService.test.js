import assert from 'node:assert/strict'
import { test } from 'node:test'
import { synthesizeSpeech } from '../server/src/services/speechService.js'

test('cloud speech sends style and text with credentials only to the upstream service', async (t) => {
  const oldKey = process.env.QWEN_API_KEY
  const oldProvider = process.env.TTS_PROVIDER
  process.env.QWEN_API_KEY = 'test-only-key'
  process.env.TTS_PROVIDER = 'qwen'
  t.after(() => {
    if (oldKey === undefined) delete process.env.QWEN_API_KEY; else process.env.QWEN_API_KEY = oldKey
    if (oldProvider === undefined) delete process.env.TTS_PROVIDER; else process.env.TTS_PROVIDER = oldProvider
  })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!options.body) {
      assert.match(url, /^https:\/\/dashscope-result-bj\.oss-cn-beijing\.aliyuncs\.com\//)
      assert.equal(options.headers, undefined)
      const wav = Buffer.alloc(44)
      wav.write('RIFF', 0); wav.write('WAVE', 8)
      return new Response(wav, { headers: { 'Content-Type': 'audio/wav' } })
    }
    assert.match(url, /dashscope.aliyuncs.com/)
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'qwen3-tts-instruct-flash')
    assert.equal(body.input.text, '我们慢慢来。')
    assert.match(body.input.instructions, /温柔/)
    assert.equal(body.input.voice, 'Cherry')
    return { ok: true, json: async () => ({ output: { audio: { url: 'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/test.wav' } } }) }
  })
  const result = await synthesizeSpeech('我们慢慢来。')
  assert.equal(result.contentType, 'audio/wav')
  assert.equal(result.audio.toString('ascii', 0, 4), 'RIFF')
  assert.equal(result.url, undefined)
  assert.equal(JSON.stringify(result).includes('test-only-key'), false)
})

test('missing cloud key produces a configuration error instead of pretending to synthesize', async (t) => {
  const oldKey = process.env.QWEN_API_KEY
  delete process.env.QWEN_API_KEY
  t.after(() => { if (oldKey !== undefined) process.env.QWEN_API_KEY = oldKey })
  await assert.rejects(synthesizeSpeech('你好'), { code: 'TTS_NOT_CONFIGURED' })
})
