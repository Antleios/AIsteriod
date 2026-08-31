import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import prisma from '../src/db/prisma.js'
import { createUser } from '../src/services/authService.js'
import { patientInteractionOutputSchema } from '../src/validation/aiSchemas.js'

const app = createApp()
const allowedOrigin = 'http://localhost:5173'

async function addPatient(overrides = {}) {
  return createUser({
    username: 'training.patient',
    password: 'correct-horse-battery-staple',
    displayName: '训练患者',
    role: 'PATIENT',
    ...overrides,
  })
}

async function login(username = 'training.patient') {
  const response = await request(app)
    .post('/api/auth/login')
    .set('Origin', allowedOrigin)
    .send({ username, password: 'correct-horse-battery-staple' })

  return response.headers['set-cookie'][0].split(';')[0]
}

beforeEach(async () => {
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

describe('training session API', () => {
  it('keeps the existing deterministic chat response contract', async () => {
    const response = await request(app).post('/api/ai/chat').send({
      messages: [{ role: 'user', content: '你好' }],
    })

    assert.equal(response.status, 200)
    assert.equal(typeof response.body.reply, 'string')
    assert.ok(response.body.reply.length > 0)
    assert.equal(response.body.output.schemaVersion, 'patient-interaction-output.v1')
    assert.equal(response.body.output.reply, response.body.reply)
    assert.equal(response.body.ai.prompt.version, 'patient-interaction-v2')
  })

  it('accepts patient replies up to 1000 characters', () => {
    const reply = '好'.repeat(1_000)
    assert.equal(
      patientInteractionOutputSchema.safeParse({
        schemaVersion: 'patient-interaction-output.v1',
        reply,
        emotion: 'encouraging',
      }).success,
      true,
    )
    assert.equal(
      patientInteractionOutputSchema.safeParse({
        schemaVersion: 'patient-interaction-output.v1',
        reply: `${reply}好`,
        emotion: 'encouraging',
      }).success,
      false,
    )
  })

  it('stores the AI chat greeting as an idempotent assistant turn', async () => {
    await addPatient()
    const cookie = await login()
    const created = await request(app)
      .post('/api/training/sessions')
      .set('Cookie', cookie)
      .send({})
    const sessionId = created.body.session.id
    const body = {
      clientRequestId: 'chat-greeting-v1',
      trigger: 'CHAT_START',
      context: 'CHAT',
    }

    const greeting = await request(app)
      .post(`/api/ai/sessions/${sessionId}/interactions`)
      .set('Cookie', cookie)
      .send(body)
    const retry = await request(app)
      .post(`/api/ai/sessions/${sessionId}/interactions`)
      .set('Cookie', cookie)
      .send(body)

    assert.equal(greeting.status, 201)
    assert.match(greeting.body.interaction.reply, /小星/)
    assert.equal(retry.body.interaction.id, greeting.body.interaction.id)
    const turns = await prisma.conversationTurn.findMany({ where: { sessionId } })
    assert.equal(turns.length, 1)
    assert.equal(turns[0].role, 'ASSISTANT')
    assert.equal(turns[0].content, greeting.body.interaction.reply)
    assert.equal(Number.isInteger(turns[0].responseLatencyMs), true)
  })

  it('stores a completed session memory and injects its snapshot into the next session', async () => {
    await addPatient()
    const cookie = await login()

    const firstSession = await request(app)
      .post('/api/training/sessions')
      .set('Cookie', cookie)
      .send({})
    const firstSessionId = firstSession.body.session.id
    const firstInteraction = await request(app)
      .post(`/api/ai/sessions/${firstSessionId}/interactions`)
      .set('Cookie', cookie)
      .send({
        clientRequestId: 'memory-first-interaction',
        trigger: 'USER_MESSAGE',
        context: 'CHAT',
        userText: '下次我想继续聊画画。',
      })
    assert.equal(firstInteraction.status, 201)

    const finalized = await request(app)
      .post(`/api/training/sessions/${firstSessionId}/finalize`)
      .set('Cookie', cookie)
      .send({})
    assert.equal(finalized.status, 200)

    const memory = await prisma.sessionConversationMemory.findUniqueOrThrow({
      where: { sessionId: firstSessionId },
      select: { status: true, provider: true, model: true, resultJson: true },
    })
    assert.equal(memory.status, 'READY')
    assert.equal(memory.provider, 'deterministic')
    assert.equal(memory.model, null)
    assert.equal(JSON.parse(memory.resultJson).schemaVersion, 'session-conversation-memory-output.v1')

    const secondSession = await request(app)
      .post('/api/training/sessions')
      .set('Cookie', cookie)
      .send({})
    const secondSessionId = secondSession.body.session.id
    const storedSecondSession = await prisma.trainingSession.findUniqueOrThrow({
      where: { id: secondSessionId },
      select: { previousConversationMemoryJson: true },
    })
    assert.deepEqual(
      JSON.parse(storedSecondSession.previousConversationMemoryJson),
      JSON.parse(memory.resultJson),
    )

    const secondInteraction = await request(app)
      .post(`/api/ai/sessions/${secondSessionId}/interactions`)
      .set('Cookie', cookie)
      .send({
        clientRequestId: 'memory-second-interaction',
        trigger: 'USER_MESSAGE',
        context: 'CHAT',
        userText: '你好。',
      })
    assert.equal(secondInteraction.status, 201)

    const savedInteraction = await prisma.aiInteraction.findUniqueOrThrow({
      where: { id: secondInteraction.body.interaction.id },
      select: { requestJson: true },
    })
    assert.deepEqual(
      JSON.parse(savedInteraction.requestJson).previousSessionMemory,
      JSON.parse(memory.resultJson),
    )
  })

  it('keeps an immutable game snapshot, evaluates attempts server-side, and finalizes metrics', async () => {
    await addPatient()
    const cookie = await login()

    const created = await request(app)
      .post('/api/training/sessions')
      .set('Cookie', cookie)
      .send({ metadata: { entry: 'manual-test' } })
    assert.equal(created.status, 201)
    const sessionId = created.body.session.id

    const gameRunResponse = await request(app)
      .post(`/api/training/sessions/${sessionId}/game-runs`)
      .set('Cookie', cookie)
      .send({ gameCode: 'emoji-match' })
    assert.equal(gameRunResponse.status, 201)
    const gameRun = gameRunResponse.body.gameRun
    assert.equal(gameRun.questions.length, 8)
    assert.equal(gameRun.questions[0].answer, undefined)
    assert.equal(gameRun.questions[0].options.some((option) => 'isCorrect' in option), false)

    const question = gameRun.questions[0]
    const wrongAttempt = await request(app)
      .post(`/api/training/sessions/${sessionId}/questions/${question.id}/attempts`)
      .set('Cookie', cookie)
      .send({ answer: 'not-an-option', responseTimeMs: 1200 })
    assert.equal(wrongAttempt.status, 201)
    assert.equal(wrongAttempt.body.attempt.isCorrect, false)

    const privateQuestion = await prisma.gameRunQuestion.findUniqueOrThrow({
      where: { id: question.id },
      select: { answerJson: true },
    })
    const correctOptionId = JSON.parse(privateQuestion.answerJson).correctOptionId

    const correctAttempt = await request(app)
      .post(`/api/training/sessions/${sessionId}/questions/${question.id}/attempts`)
      .set('Cookie', cookie)
      .send({ answer: correctOptionId, responseTimeMs: 800 })
    assert.equal(correctAttempt.status, 201)
    assert.equal(correctAttempt.body.attempt.isCorrect, true)

    const events = {
      events: [
        {
          clientEventId: 'training-test-idle-1',
          type: 'LONG_IDLE',
          gameRunId: gameRun.id,
          data: { idleDurationMs: 23000 },
        },
      ],
    }
    const firstEvent = await request(app)
      .post(`/api/training/sessions/${sessionId}/events`)
      .set('Cookie', cookie)
      .send(events)
    const duplicateEvent = await request(app)
      .post(`/api/training/sessions/${sessionId}/events`)
      .set('Cookie', cookie)
      .send(events)
    assert.deepEqual(firstEvent.body.result, { accepted: 1, duplicate: 0 })
    assert.deepEqual(duplicateEvent.body.result, { accepted: 0, duplicate: 1 })

    const turn = await request(app)
      .post(`/api/training/sessions/${sessionId}/conversation-turns`)
      .set('Cookie', cookie)
      .send({
        role: 'USER',
        context: 'EMOJI_MATCH',
        content: '这个有点难。',
        inputMethod: 'ASR',
        isUserInitiated: true,
      })
    assert.equal(turn.status, 201)
    assert.equal(turn.body.turn.sequence, 1)

    const finalized = await request(app)
      .post(`/api/training/sessions/${sessionId}/finalize`)
      .set('Cookie', cookie)
    assert.equal(finalized.status, 200)
    assert.equal(finalized.body.session.status, 'COMPLETED')
    assert.equal(finalized.body.session.summary.status, 'READY')
    assert.equal(finalized.body.session.metrics.games[0].wrongCount, 1)
    assert.equal(finalized.body.session.metrics.conversation.userUtteranceCount, 1)

    const doctor = await addPatient({
      username: 'doctor.one',
      displayName: '测试医生',
      role: 'DOCTOR',
    })
    await addPatient({
      username: 'admin.one',
      displayName: '测试管理员',
      role: 'ADMIN',
    })
    const adminCookie = await login('admin.one')
    const doctorCookie = await login('doctor.one')
    const doctorOwnSessions = await request(app)
      .get('/api/training/sessions')
      .set('Cookie', doctorCookie)
    assert.equal(doctorOwnSessions.status, 403)
    assert.equal(doctorOwnSessions.body.error.code, 'PATIENT_ROLE_REQUIRED')
    const assignment = await request(app)
      .post('/api/training/care-assignments')
      .set('Cookie', adminCookie)
      .send({ clinicianId: doctor.id, patientId: created.body.session.userId })
    assert.equal(assignment.status, 201)

    const doctorSession = await request(app)
      .get(`/api/training/doctor/sessions/${sessionId}`)
      .set('Cookie', doctorCookie)
    assert.equal(doctorSession.status, 200)
    assert.equal(doctorSession.body.session.summary.status, 'READY')
    assert.equal(doctorSession.body.session.conversationTurns, undefined)

    const blockedWrite = await request(app)
      .post(`/api/training/sessions/${sessionId}/conversation-turns`)
      .set('Cookie', cookie)
      .send({ role: 'USER', content: '结束后不能写入' })
    assert.equal(blockedWrite.status, 409)
    assert.equal(blockedWrite.body.error.code, 'SESSION_NOT_ACTIVE')
  })

  it('does not expose another patient’s training session', async () => {
    await addPatient()
    const firstCookie = await login()
    const created = await request(app)
      .post('/api/training/sessions')
      .set('Cookie', firstCookie)
      .send({})

    await addPatient({ username: 'other.patient', displayName: '其他患者' })
    const secondCookie = await login('other.patient')
    const response = await request(app)
      .get(`/api/training/sessions/${created.body.session.id}`)
      .set('Cookie', secondCookie)

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'SESSION_NOT_FOUND')
  })

  it('records answer reveals, closes unfinished runs, and protects training writes by origin', async () => {
    await addPatient()
    const cookie = await login()
    const created = await request(app)
      .post('/api/training/sessions')
      .set('Cookie', cookie)
      .send({})
    const sessionId = created.body.session.id

    const blocked = await request(app)
      .post(`/api/training/sessions/${sessionId}/events`)
      .set('Cookie', cookie)
      .set('Origin', 'https://untrusted.example')
      .send({ events: [{ clientEventId: 'blocked-origin', type: 'IDLE' }] })
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error.code, 'ORIGIN_NOT_ALLOWED')

    const gameRunResponse = await request(app)
      .post(`/api/training/sessions/${sessionId}/game-runs`)
      .set('Cookie', cookie)
      .send({ gameCode: 'object-naming' })
    assert.equal(gameRunResponse.status, 201)
    const question = gameRunResponse.body.gameRun.questions[0]
    assert.equal(question.answer, undefined)
    assert.equal(question.displayAnswer, undefined)

    const privateQuestion = await prisma.gameRunQuestion.findUniqueOrThrow({
      where: { id: question.id },
      select: { answerJson: true },
    })
    const expectedDisplayAnswer = JSON.parse(privateQuestion.answerJson).displayAnswer
    assert.equal(typeof expectedDisplayAnswer, 'string')

    const revealed = await request(app)
      .post(`/api/training/sessions/${sessionId}/questions/${question.id}/attempts`)
      .set('Cookie', cookie)
      .send({ action: 'REVEAL', responseTimeMs: 900 })
    assert.equal(revealed.status, 201)
    assert.equal(revealed.body.attempt.isCorrect, false)
    assert.equal(revealed.body.attempt.isRevealed, true)
    assert.equal(revealed.body.attempt.outcome, 'REVEALED')
    assert.equal(revealed.body.attempt.revealedAnswer, expectedDisplayAnswer)

    const completedQuestion = await prisma.gameRunQuestion.findUniqueOrThrow({
      where: { id: question.id },
      include: { attempts: true },
    })
    assert.ok(completedQuestion.completedAt)
    assert.equal(completedQuestion.attempts[0].outcome, 'REVEALED')

    const duplicate = await request(app)
      .post(`/api/training/sessions/${sessionId}/questions/${question.id}/attempts`)
      .set('Cookie', cookie)
      .send({ answer: 'anything' })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.error.code, 'QUESTION_ALREADY_COMPLETED')

    const finalized = await request(app)
      .post(`/api/training/sessions/${sessionId}/finalize`)
      .set('Cookie', cookie)
      .send({})
    assert.equal(finalized.status, 200)
    assert.equal(finalized.body.session.status, 'COMPLETED')
    assert.equal(finalized.body.session.gameRuns[0].status, 'ABANDONED')
  })

  it('records a session-aware AI interaction and returns the saved result on retry', async () => {
    await addPatient()
    const cookie = await login()
    const created = await request(app)
      .post('/api/training/sessions')
      .set('Cookie', cookie)
      .send({})
    const sessionId = created.body.session.id

    const unauthenticated = await request(app)
      .post(`/api/ai/sessions/${sessionId}/interactions`)
      .send({
        clientRequestId: 'ai-interaction-1',
        trigger: 'USER_MESSAGE',
        context: 'CHAT',
        userText: '我不喜欢这个。',
      })
    assert.equal(unauthenticated.status, 401)

    const requestBody = {
      clientRequestId: 'ai-interaction-1',
      trigger: 'USER_MESSAGE',
      context: 'CHAT',
      userText: '我不喜欢这个。',
      inputMethod: 'ASR',
    }
    const response = await request(app)
      .post(`/api/ai/sessions/${sessionId}/interactions`)
      .set('Origin', allowedOrigin)
      .set('Cookie', cookie)
      .send(requestBody)
    assert.equal(response.status, 201)
    assert.equal(response.body.interaction.status, 'READY')
    assert.equal(response.body.interaction.emotion, 'empathetic')
    assert.match(response.body.interaction.reply, /停一下/)
    assert.equal(
      response.body.interaction.output.schemaVersion,
      'patient-interaction-output.v1',
    )
    assert.equal(response.body.interaction.output.reply, response.body.interaction.reply)
    assert.equal(response.body.interaction.prompt.version, 'patient-interaction-v2')

    const retry = await request(app)
      .post(`/api/ai/sessions/${sessionId}/interactions`)
      .set('Origin', allowedOrigin)
      .set('Cookie', cookie)
      .send(requestBody)
    assert.equal(retry.status, 201)
    assert.equal(retry.body.interaction.id, response.body.interaction.id)
    assert.equal(retry.body.interaction.reply, response.body.interaction.reply)

    const turns = await prisma.conversationTurn.findMany({
      where: { sessionId },
      orderBy: { sequence: 'asc' },
      select: { role: true, content: true, inputMethod: true },
    })
    assert.deepEqual(turns, [
      { role: 'USER', content: '我不喜欢这个。', inputMethod: 'ASR' },
      { role: 'ASSISTANT', content: response.body.interaction.reply, inputMethod: 'SYSTEM' },
    ])
    assert.equal(await prisma.aiInteraction.count({ where: { sessionId } }), 1)
    const interaction = await prisma.aiInteraction.findUniqueOrThrow({
      where: { id: response.body.interaction.id },
      select: { requestJson: true, resultJson: true },
    })
    assert.equal(JSON.parse(interaction.requestJson).schemaVersion, 'patient-interaction-input.v1')
    assert.equal(JSON.parse(interaction.resultJson).schemaVersion, 'patient-interaction-output.v1')

    const invalid = await request(app)
      .post(`/api/ai/sessions/${sessionId}/interactions`)
      .set('Cookie', cookie)
      .send({
        clientRequestId: 'ai-interaction-2',
        trigger: 'USER_MESSAGE',
        context: 'CHAT',
      })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR')
  })
})
