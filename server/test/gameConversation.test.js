import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import prisma from '../src/db/prisma.js'
import { createUser } from '../src/services/authService.js'

const app = createApp()

test('authenticated speech route streams PCM and serves fixed speech from cache', async t => {
  configure(t, { TTS_PROVIDER: 'qwen', QWEN_API_KEY: 'test-only-key', QWEN_TTS_VOICE: 'route-test-voice' })
  const cookie = await patient()
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return new Response('data:{"output":{"audio":{"data":"AQACAAMA"}}}\n\ndata:{"output":{"audio":{"data":""},"finish_reason":"stop"}}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  })
  for (const cache of ['MISS', 'HIT']) {
    const response = await request(app).post('/api/ai/speech').set('Cookie', cookie).send({ text: '请说出图片上的物品名称', stream: true }).buffer(true).parse((res, callback) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => callback(null, Buffer.concat(chunks)))
      res.on('error', callback)
    })
    assert.equal(response.status, 200)
    assert.match(response.headers['content-type'], /^audio\/pcm/)
    assert.equal(response.headers['x-speech-cache'], cache)
    assert.equal(response.headers['x-accel-buffering'], 'no')
    assert.deepEqual(response.body, Buffer.from([1,0,2,0,3,0]))
  }
  assert.equal(calls, 1)
})

test('proactive encouragement calls Qwen without inventing a user message or scoring an answer', async t => {
  configure(t, { AI_INTERACTION_PROVIDER: 'qwen', QWEN_API_KEY: 'test-only-key' })
  const cookie = await patient()
  const session = (await request(app).post('/api/training/sessions').set('Cookie', cookie).send({})).body.session
  const run = (await request(app).post(`/api/training/sessions/${session.id}/game-runs`).set('Cookie', cookie).send({ gameCode: 'object-naming' })).body.gameRun
  const triggers = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const input = JSON.parse(JSON.parse(options.body).messages[1].content)
    assert.equal(input.user, null)
    triggers.push(input.interaction.trigger)
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: '不着急，我们可以一起慢慢看看。', emotion: 'encouraging' }) } }] }) }
  })
  for (const trigger of ['LONG_IDLE', 'MULTIPLE_WRONG']) {
    const response = await request(app).post(`/api/ai/sessions/${session.id}/interactions`).set('Cookie', cookie).send({ clientRequestId: trigger, trigger, context: 'OBJECT_NAMING', gameRunId: run.id, questionId: run.questions[0].id, inputMethod: 'TEXT' })
    assert.equal(response.status, 201)
    assert.equal(response.body.interaction.provider, 'qwen')
  }
  assert.deepEqual(triggers, ['LONG_IDLE', 'MULTIPLE_WRONG'])
  assert.equal(await prisma.gameAttempt.count(), 0)
  assert.equal(await prisma.conversationTurn.count({ where: { sessionId: session.id, role: 'USER' } }), 0)
  assert.equal(await prisma.conversationTurn.count({ where: { sessionId: session.id, role: 'ASSISTANT' } }), 2)
})

test('object utterances separate conversation from scored answers and fail without scoring', async (t) => {
  configure(t, { AI_INTERACTION_PROVIDER: 'qwen', QWEN_API_KEY: 'test-only-key' })
  const cookie = await patient()
  const session = (await request(app).post('/api/training/sessions').set('Cookie', cookie).send({})).body.session
  const run = (await request(app).post(`/api/training/sessions/${session.id}/game-runs`).set('Cookie', cookie).send({ gameCode: 'object-naming' })).body.gameRun
  const questionId = run.questions[0].id
  const endpoint = `/api/training/sessions/${session.id}/questions/${questionId}/attempts`
  let output
  let fail = false
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const input = JSON.parse(JSON.parse(options.body).messages[1].content)
    assert.ok(input.acceptedAnswers.length)
    if (fail) throw new Error('offline')
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(output) } }] }) }
  })
  for (const intent of ['chat', 'uncertain']) {
    output = { intent, isCorrect: null, reply: '你想聊聊今天的事情吗？' }
    const result = await request(app).post(endpoint).set('Cookie', cookie).send({ answer: '我今天吃了苹果', inputMethod: 'ASR' })
    assert.equal(result.status, 201)
    assert.equal(result.body.attempt.outcome, 'CONVERSATION')
    assert.equal(result.body.attempt.isCorrect, null)
    assert.equal(await prisma.gameAttempt.count(), 0)
    assert.equal((await prisma.gameRunQuestion.findUnique({ where: { id: questionId } })).completedAt, null)
  }
  fail = true
  assert.equal((await request(app).post(endpoint).set('Cookie', cookie).send({ answer: '这是苹果' })).status, 502)
  assert.equal(await prisma.gameAttempt.count(), 0)
  fail = false
  output = { intent: 'chat', isCorrect: false, reply: '无效结果' }
  assert.equal((await request(app).post(endpoint).set('Cookie', cookie).send({ answer: '今天很开心' })).status, 502)
  assert.equal(await prisma.gameAttempt.count(), 0)
  let wrongCount = 0
  for (const correct of [false, false, false, true]) {
    output = { intent: 'answer', isCorrect: correct, reply: correct ? '是的，你认出来了。' : '我们再看看它的形状。' }
    const result = await request(app).post(endpoint).set('Cookie', cookie).send({ answer: '看起来像苹果' })
    assert.equal(result.status, 201)
    assert.equal(result.body.attempt.isCorrect, correct)
    assert.equal(result.body.attempt.feedback, output.reply)
    if (!correct) wrongCount++
    assert.equal(result.body.attempt.multipleWrong, !correct && wrongCount === 2)
  }
  assert.equal(await prisma.gameAttempt.count(), 4)
  assert.equal(await prisma.interactionEvent.count({ where: { sessionId: session.id, type: 'MULTIPLE_WRONG' } }), 1)
  assert.equal(await prisma.conversationTurn.count({ where: { sessionId: session.id } }), 12)
})
beforeEach(async () => { await prisma.user.deleteMany() })
after(async () => { await prisma.$disconnect() })

async function patient(username = 'game.chat.patient') {
  await createUser({ username, password: 'test-only-long-password', displayName: '测试患者', role: 'PATIENT' })
  const login = await request(app).post('/api/auth/login').send({ username, password: 'test-only-long-password' })
  return login.headers['set-cookie'][0].split(';')[0]
}

function configure(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(values)) process.env[key] = value
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}

test('game questions call Qwen with trusted clues, save dialogue, and do not score an attempt', async (t) => {
  configure(t, { AI_INTERACTION_PROVIDER: 'qwen', QWEN_API_KEY: 'test-only-key', AI_INTERACTION_PROMPT_VERSION: 'patient-interaction-v2' })
  const cookie = await patient()
  const session = (await request(app).post('/api/training/sessions').set('Cookie', cookie).send({})).body.session
  const run = (await request(app).post(`/api/training/sessions/${session.id}/game-runs`).set('Cookie', cookie).send({ gameCode: 'object-naming' })).body.gameRun
  const question = await prisma.gameRunQuestion.findUniqueOrThrow({ where: { id: run.questions[0].id } })
  const answer = JSON.parse(question.answerJson).displayAnswer
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++
    assert.match(url, /chat\/completions$/)
    const body = JSON.parse(options.body)
    assert.equal(body.enable_thinking, false)
    const input = JSON.parse(body.messages[1].content)
    assert.equal(input.gameState.answerCharacterCount, Array.from(answer).length)
    assert.equal(JSON.stringify(input.gameState).includes(answer), false)
    assert.equal(input.gameState.answer, undefined)
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: `它的名字有${Array.from(answer).length}个字，我们慢慢想。`, emotion: 'encouraging' }) } }] }) }
  })
  const body = { clientRequestId: 'game-help-1', context: 'OBJECT_NAMING', trigger: 'USER_MESSAGE', gameRunId: run.id, questionId: question.id, userText: '这个物品的名称是几个字', gameState: { answer: '伪造答案', answerCharacterCount: 999 } }
  const response = await request(app).post(`/api/ai/sessions/${session.id}/interactions`).set('Cookie', cookie).send(body)
  assert.equal(response.status, 201)
  assert.equal(response.body.interaction.provider, 'qwen')
  assert.equal(await prisma.gameAttempt.count(), 0)
  assert.equal(await prisma.conversationTurn.count({ where: { sessionId: session.id } }), 2)
  const retry = await request(app).post(`/api/ai/sessions/${session.id}/interactions`).set('Cookie', cookie).send(body)
  assert.equal(retry.status, 201)
  assert.equal(calls, 1)
  const stranger = await patient('other.patient')
  const forbidden = await request(app).post(`/api/ai/sessions/${session.id}/interactions`).set('Cookie', stranger).send(body)
  assert.equal(forbidden.status, 404)
  const invalid = await request(app).post(`/api/ai/sessions/${session.id}/interactions`).set('Cookie', cookie).send({ ...body, clientRequestId: 'wrong-context', context: 'EMOJI_MATCH' })
  assert.equal(invalid.status, 400)
})

test('missing chat key is a clear configuration error, not an offline reply', async (t) => {
  configure(t, { AI_INTERACTION_PROVIDER: 'qwen', QWEN_API_KEY: '' })
  const cookie = await patient()
  const session = (await request(app).post('/api/training/sessions').set('Cookie', cookie).send({})).body.session
  const response = await request(app).post(`/api/ai/sessions/${session.id}/interactions`).set('Cookie', cookie).send({ clientRequestId: 'no-key', trigger: 'USER_MESSAGE', context: 'CHAT', userText: '你好' })
  assert.equal(response.status, 503)
  assert.equal(response.body.error.code, 'AI_NOT_CONFIGURED')
})

test('speech endpoint requires patient authentication and validates length', async (t) => {
  configure(t, { TTS_PROVIDER: 'browser' })
  assert.equal((await request(app).post('/api/ai/speech').send({ text: '你好' })).status, 401)
  const cookie = await patient()
  assert.equal((await request(app).post('/api/ai/speech').set('Cookie', cookie).send({ text: '你'.repeat(501) })).status, 400)
  const response = await request(app).post('/api/ai/speech').set('Cookie', cookie).send({ text: '我们慢慢来' })
  assert.equal(response.status, 200)
  assert.equal(response.body.provider, 'browser')
})
