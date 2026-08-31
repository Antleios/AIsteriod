import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createVoiceInput } from '../src/api/voiceInput.js'

function setup(t, initialText = '', autoSend = false) {
  let recognition
  class Recognition {
    constructor() { recognition = this }
    start() { this.onstart?.() }
    stop() { this.stopped = true }
    abort() { this.aborted = true }
  }
  const texts = []
  const statuses = []
  const errors = []
  const sent = []
  const input = createVoiceInput({
    Recognition, initialText,
    onText: (text) => texts.push(text),
    onStatus: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
    ...(autoSend ? { onAutoSend: (text) => sent.push(text) } : {}),
  })
  t.after(() => input.dispose())
  input.start()
  const result = (parts, resultIndex = 0) => recognition.onresult?.({
    resultIndex,
    results: parts.map((transcript) => [{ transcript }]),
  })
  return { input, recognition, texts, statuses, errors, result, sent }
}

test('live revisions preserve earlier segments without duplicating interim text', (t) => {
  const s = setup(t)
  s.result(['今天'])
  assert.equal(s.texts.at(-1), '今天')
  s.result(['今天很好。', '我想'], 1)
  s.result(['今天很好。', '我想玩游戏。'], 1)
  assert.equal(s.texts.at(-1), '今天很好。我想玩游戏。')
  assert.equal(s.recognition.continuous, true)
  assert.equal(s.recognition.interimResults, true)
})

test('manual stop accepts late final results and preserves the draft', (t) => {
  const s = setup(t, '之前的话。')
  s.result(['我很开'])
  s.input.stop()
  assert.equal(s.statuses.at(-1), 'stopping')
  assert.equal(s.recognition.stopped, true)
  s.result(['我很开心。'])
  s.recognition.onend()
  assert.equal(s.texts.at(-1), '之前的话。我很开心。')
  assert.equal(s.statuses.at(-1), 'idle')
})

test('natural end retains text instead of silently discarding or sending it', (t) => {
  const s = setup(t)
  s.result(['你好'])
  s.recognition.onend()
  assert.equal(s.texts.at(-1), '你好')
  assert.equal(s.statuses.at(-1), 'idle')
})

test('recognition failure explains the error and preserves partial text', (t) => {
  const s = setup(t)
  s.result(['保留这句话'])
  s.recognition.onerror({ error: 'network' })
  assert.match(s.errors.at(-1), /连接失败/)
  assert.equal(s.texts.at(-1), '保留这句话')
  assert.equal(s.statuses.at(-1), 'idle')
})

test('stop completes even when the browser never fires onend', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(t)
  s.result(['不要丢失'])
  s.input.stop()
  t.mock.timers.tick(2000)
  assert.equal(s.texts.at(-1), '不要丢失')
  assert.equal(s.statuses.at(-1), 'idle')
  assert.equal(s.recognition.aborted, true)
  assert.equal(s.recognition.onresult, null)
})

test('no recognition results produce a visible warning', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(t)
  t.mock.timers.tick(12_000)
  assert.match(s.errors.at(-1), /暂未收到识别文字/)
})

test('leaving the page detaches callbacks and aborts without changing the draft', (t) => {
  const s = setup(t)
  s.result(['已输入'])
  const count = s.texts.length
  s.input.dispose()
  assert.equal(s.recognition.onend, null)
  assert.equal(s.recognition.onresult, null)
  assert.equal(s.recognition.aborted, true)
  assert.equal(s.texts.length, count)
})

test('two seconds without new speech sends the latest full transcript exactly once', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(t, '', true)
  s.result(['你好'])
  t.mock.timers.tick(1500)
  s.result(['你好小星'])
  t.mock.timers.tick(1999)
  assert.deepEqual(s.sent, [])
  t.mock.timers.tick(1)
  assert.deepEqual(s.sent, ['你好小星'])
  assert.equal(s.statuses.at(-1), 'idle')
  t.mock.timers.tick(5000)
  assert.equal(s.sent.length, 1)
})

test('resumed speech cancels the pending send until a new pause', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(t, '', true)
  s.result(['今天'])
  t.mock.timers.tick(1000)
  s.recognition.onspeechstart()
  t.mock.timers.tick(3000)
  assert.deepEqual(s.sent, [])
  s.result(['今天很开心'])
  s.recognition.onspeechend()
  t.mock.timers.tick(2000)
  assert.deepEqual(s.sent, ['今天很开心'])
})

test('browser ending early still waits for the two-second pause', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(t, '', true)
  s.result(['你好'])
  t.mock.timers.tick(500)
  s.recognition.onend()
  t.mock.timers.tick(1499)
  assert.deepEqual(s.sent, [])
  t.mock.timers.tick(1)
  assert.deepEqual(s.sent, ['你好'])
})

test('manual stop cancels auto-send and preserves the final transcript', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = setup(t, '', true)
  s.result(['保留'])
  s.input.stop()
  s.result(['保留草稿'])
  s.recognition.onend()
  t.mock.timers.tick(5000)
  assert.deepEqual(s.sent, [])
  assert.equal(s.texts.at(-1), '保留草稿')
})

test('errors and empty recordings never auto-send', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const empty = setup(t, '旧草稿', true)
  t.mock.timers.tick(3000)
  assert.deepEqual(empty.sent, [])
  const failed = setup(t, '', true)
  failed.result(['部分内容'])
  failed.recognition.onerror({ error: 'network' })
  t.mock.timers.tick(5000)
  assert.deepEqual(failed.sent, [])
})
