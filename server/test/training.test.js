import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import prisma from '../src/db/prisma.js'
import { createUser } from '../src/services/authService.js'

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
})
