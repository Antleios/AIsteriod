// Qwen HTTP streaming emits signed 16-bit little-endian PCM, mono, 24 kHz.
export async function playPcmResponse(response, context, signal, onStart) {
  const reader = response.body.getReader()
  const sources = new Set()
  let tail = new Uint8Array(0)
  let nextTime = context.currentTime + 0.06
  let ended = false
  let started = false
  let startTimer
  let total = 0
  let resolveDone, rejectDone
  const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject })
  // A network failure may precede the final await below.
  void done.catch(() => {})
  const abort = () => {
    void reader.cancel().catch(() => {})
    for (const source of sources) { source.onended = null; source.stop(); source.disconnect() }
    sources.clear()
    clearInterval(startTimer)
    rejectDone(new Error('PCM playback cancelled'))
  }
  signal.addEventListener('abort', abort, { once: true })
  try {
    signal.throwIfAborted()
    while (true) {
      const { done: finished, value } = await reader.read()
      signal.throwIfAborted()
      if (finished) break
      total += value.length
      if (total > 12 * 1024 * 1024) throw new Error('PCM stream too large')
      const bytes = new Uint8Array(tail.length + value.length)
      bytes.set(tail); bytes.set(value, tail.length)
      const length = bytes.length - bytes.length % 2
      tail = bytes.slice(length)
      if (!length) continue
      const buffer = context.createBuffer(1, length / 2, 24000)
      const samples = buffer.getChannelData(0)
      const view = new DataView(bytes.buffer)
      for (let index = 0; index < samples.length; index++) samples[index] = view.getInt16(index * 2, true) / 32768
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      sources.add(source)
      source.onended = () => {
        sources.delete(source); source.disconnect()
        if (ended && !sources.size) resolveDone()
      }
      const when = Math.max(nextTime, context.currentTime + 0.03)
      source.start(when)
      nextTime = when + buffer.duration
      if (!started) {
        started = true
        startTimer = setInterval(() => {
          if (context.state === 'running' && context.currentTime >= when) {
            clearInterval(startTimer); onStart()
          }
        }, 10)
      }
    }
    if (!total || tail.length) throw new Error('Empty or incomplete PCM stream')
    ended = true
    if (!sources.size) resolveDone()
    await done
    signal.throwIfAborted()
  } catch (error) { abort(); throw error }
  finally { clearInterval(startTimer); signal.removeEventListener('abort', abort); reader.releaseLock() }
}
