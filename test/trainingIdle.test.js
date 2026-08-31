import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startTrainingIdleTracker } from '../src/hooks/useTrainingIdleTracker.js'

function setup(t) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 0 })
  const previous = { window: globalThis.window, document: globalThis.document }
  globalThis.window = new EventTarget()
  window.setInterval = setInterval
  globalThis.document = new EventTarget()
  document.hidden = false
  const calls = []
  const events = []
  let busy
  const options = { current: { paused: false, questionId: 'q1', conversationRef: { current: { nudge: async (...args) => calls.push(args) } } } }
  const stop = startTrainingIdleTracker('run1', options, async (value) => events.push(...value), callback => { busy = callback; callback(false); return () => {} })
  t.after(() => { stop(); Object.assign(globalThis, previous) })
  return { calls, events, options, busy: value => busy(value), tick: async ms => { t.mock.timers.tick(ms); await Promise.resolve(); await Promise.resolve() }, emit: (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail })) }
}

test('five seconds triggers once; assistant completion does not cause a reminder loop', async t => {
  const s = setup(t)
  await s.tick(4750)
  assert.equal(s.calls.length, 0)
  await s.tick(250)
  assert.deepEqual(s.calls, [['LONG_IDLE', 'q1']])
  s.emit('game-speech-activity', { speaking: false })
  s.busy(true)
  await s.tick(6000)
  s.busy(false)
  await s.tick(10000)
  assert.equal(s.calls.length, 1)
  s.emit('pointerdown')
  await s.tick(5000)
  assert.equal(s.calls.length, 2)
})

test('speech and keyboard reset the deadline; active speech, hidden page and API waiting suppress nudges', async t => {
  const s = setup(t)
  await s.tick(4000)
  s.emit('keydown')
  await s.tick(4000)
  assert.equal(s.calls.length, 0)
  s.emit('game-speech-activity', { speaking: true })
  await s.tick(10000)
  assert.equal(s.calls.length, 0)
  s.emit('game-speech-activity', { speaking: false })
  s.options.current.paused = true
  await s.tick(10000)
  s.options.current.paused = false
  document.hidden = true
  await s.tick(10000)
  document.hidden = false
  await s.tick(4750)
  assert.equal(s.calls.length, 0)
  await s.tick(250)
  assert.equal(s.calls.length, 1)
})

test('multiple wrong waits for feedback audio, uses the correct question and does not duplicate telemetry', async t => {
  const s = setup(t)
  s.busy(true)
  s.emit('game-multiple-wrong', { gameRunId: 'run1', questionId: 'q1' })
  await s.tick(5000)
  assert.equal(s.calls.length, 0)
  s.busy(false)
  await s.tick(250)
  assert.deepEqual(s.calls, [['MULTIPLE_WRONG', 'q1']])
  assert.equal(s.events.length, 0)
  await s.tick(10000)
  assert.equal(s.calls.length, 1)
})
