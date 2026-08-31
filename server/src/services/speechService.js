export function speechSettings(text) {
  const provider = process.env.TTS_PROVIDER?.trim() || 'qwen'
  if (provider === 'browser') return { provider: 'browser' }
  if (provider !== 'qwen' || !process.env.QWEN_API_KEY?.trim()) {
    throw Object.assign(new Error('云端语音尚未配置，将使用浏览器语音'), { status: 503, code: 'TTS_NOT_CONFIGURED' })
  }
  const model = process.env.QWEN_TTS_MODEL || 'qwen3-tts-instruct-flash'
  const input = { text, voice: process.env.QWEN_TTS_VOICE || 'Cherry', language_type: 'Chinese' }
  if (model.includes('instruct')) {
    input.instructions = process.env.QWEN_TTS_INSTRUCTIONS || '用温柔、自然、耐心的普通话轻声交谈，语速稍慢，停顿自然，音量平稳。像坐在身边的友善伙伴，不要播音腔、夸张兴奋或刻意装可爱。'
    input.optimize_instructions = true
  }
  return { provider, model, input, url: process.env.QWEN_TTS_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' }
}

export async function synthesizeSpeech(text) {
  const { provider, model, input, url: endpoint } = speechSettings(text)
  if (provider === 'browser') return { provider }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.QWEN_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw Object.assign(new Error('云端语音合成失败，将使用浏览器语音'), { status: 502, code: 'TTS_FAILED' })
  const body = await response.json()
  const url = new URL(body.output?.audio?.url)
  // Download only the provider's signed audio files, never arbitrary client URLs.
  if (!url.hostname.endsWith('.aliyuncs.com') || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid speech audio URL')
  url.protocol = 'https:'
  const audioResponse = await fetch(url.href, { signal: AbortSignal.timeout(15_000), redirect: 'error' })
  if (!audioResponse.ok) throw Object.assign(new Error('云端音频下载失败'), { status: 502, code: 'TTS_AUDIO_FAILED' })
  const reader = audioResponse.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 12 * 1024 * 1024) throw new Error('Speech audio too large')
      chunks.push(Buffer.from(value))
    }
  } finally { await reader.cancel() }
  const audio = Buffer.concat(chunks)
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    throw Object.assign(new Error('云端返回的音频格式无效'), { status: 502, code: 'TTS_AUDIO_INVALID' })
  }
  return { provider, model, audio, contentType: 'audio/wav' }
}
