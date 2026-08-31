import { createHash } from 'node:crypto'
import { speechSettings } from './speechService.js'
import { fixedSpeechTexts } from '../../../src/data/gameMessages.js'

const cache = new Map()
let cacheBytes = 0
const MAX_BYTES = 32 * 1024 * 1024
const MAX_AUDIO = 12 * 1024 * 1024
const TTL = 24 * 60 * 60 * 1000

function remove(key) { const item = cache.get(key); if (item) cacheBytes -= item.audio.length; cache.delete(key) }
function save(key, audio) {
  remove(key)
  while (cache.size >= 128 || cacheBytes + audio.length > MAX_BYTES) remove(cache.keys().next().value)
  cache.set(key, { audio, expires: Date.now() + TTL }); cacheBytes += audio.length
}

// SSE frames may span arbitrary HTTP chunks; never download the final signed URL.
export async function* decodeSpeechEvents(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let stopped = false
  try {
    while (!stopped) {
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      if (pending.length > 4 * 1024 * 1024) throw new Error('Speech event too large')
      let separator
      while ((separator = /\r?\n\r?\n/.exec(pending))) {
        const frame = pending.slice(0, separator.index)
        pending = pending.slice(separator.index + separator[0].length)
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data || data === '[DONE]') continue
        const event = JSON.parse(data)
        if (event.code || (event.status_code && event.status_code !== 200)) throw new Error('Speech provider error')
        const encoded = event.output?.audio?.data
        if (encoded) {
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid PCM data')
          yield Buffer.from(encoded, 'base64')
        }
        if (event.output?.finish_reason === 'stop') { stopped = true; break }
      }
    }
    if (!stopped) throw new Error('Incomplete speech stream')
  } finally { await reader.cancel().catch(() => {}) }
}

export async function openSpeechStream(text, signal) {
  const settings = speechSettings(text)
  if (settings.provider === 'browser') return settings
  const key = createHash('sha256').update(JSON.stringify(settings)).digest('hex')
  const eligible = fixedSpeechTexts.has(text)
  const hit = eligible && cache.get(key)
  if (hit && hit.expires > Date.now()) {
    cache.delete(key); cache.set(key, hit)
    return { cache: 'HIT', chunks: (async function* () {
      for (let offset = 0; offset < hit.audio.length; offset += 16384) { signal?.throwIfAborted(); yield hit.audio.subarray(offset, offset + 16384) }
    })() }
  }
  if (hit) remove(key)
  const response = await fetch(settings.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.QWEN_API_KEY}`, 'Content-Type': 'application/json', 'X-DashScope-SSE': 'enable' },
    body: JSON.stringify({ model: settings.model, input: settings.input }),
    signal: AbortSignal.any([AbortSignal.timeout(60_000), ...(signal ? [signal] : [])]),
  })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    await response.body?.cancel()
    throw Object.assign(new Error('流式语音暂不可用'), { status: 502 })
  }
  return { cache: eligible ? 'MISS' : 'BYPASS', chunks: (async function* () {
    let size = 0
    const parts = []
    for await (const part of decodeSpeechEvents(response.body)) {
      size += part.length
      if (size > MAX_AUDIO) throw new Error('Speech audio too large')
      if (eligible) parts.push(part)
      yield part
    }
    if (!size || size % 2) throw new Error('Invalid PCM length')
    signal?.throwIfAborted()
    if (eligible) save(key, Buffer.concat(parts))
  })() }
}
