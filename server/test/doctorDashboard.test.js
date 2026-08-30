import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import prisma from '../src/db/prisma.js'
import { createUser } from '../src/services/authService.js'

const app = createApp()
const password = 'correct-horse-battery-staple'

async function addUser(overrides = {}) {
  return createUser({
    username: 'dashboard.patient',
    password,
    displayName: '看板患者',
    role: 'PATIENT',
    ...overrides,
  })
}

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password })

  return response.headers['set-cookie'][0].split(';')[0]
}

async function addCompletedGameRun(patientId, options = {}) {
  const startedAt = options.startedAt ?? new Date(Date.now() - 5 * 60 * 1_000)
  const endedAt = options.endedAt ?? new Date(startedAt.getTime() + 5 * 60 * 1_000)
  const outcomes = options.outcomes ?? ['CORRECT', 'WRONG']

  return prisma.trainingSession.create({
    data: {
      userId: patientId,
      status: 'COMPLETED',
      startedAt,
      endedAt,
      metadataJson: JSON.stringify({ privateSessionMetadata: 'PRIVATE_SESSION_DATA' }),
      previousConversationMemoryJson: JSON.stringify({ memory: 'PRIVATE_MEMORY' }),
      gameRuns: {
        create: {
          gameCode: options.gameCode ?? 'object-naming',
          sequence: 1,
          status: 'COMPLETED',
          startedAt,
          endedAt,
          configSnapshotJson: JSON.stringify({ privateConfig: 'PRIVATE_CONFIG' }),
          questions: {
            create: outcomes.map((outcome, index) => ({
              position: index + 1,
              questionType: 'TEST_QUESTION',
              clientPayloadJson: JSON.stringify({ prompt: 'PRIVATE_QUESTION' }),
              answerJson: JSON.stringify({ answer: 'PRIVATE_ANSWER' }),
              completedAt: endedAt,
              attempts: {
                create: {
                  outcome,
                  answerJson: JSON.stringify({ answer: 'PRIVATE_ATTEMPT' }),
                  responseTimeMs: index === 0 ? 500 : 1_000,
                },
              },
            })),
          },
        },
      },
      conversationTurns: {
        create: {
          sequence: 1,
          role: 'USER',
          content: 'PRIVATE_TRANSCRIPT',
        },
      },
    },
    include: { gameRuns: true },
  })
}

async function addGameRunToSession(sessionId, options = {}) {
  const startedAt = options.startedAt ?? new Date(Date.now() - 5 * 60 * 1_000)

  return prisma.gameRun.create({
    data: {
      sessionId,
      gameCode: options.gameCode ?? 'object-naming',
      sequence: options.sequence ?? 2,
      status: options.status ?? 'ACTIVE',
      startedAt,
      endedAt: options.endedAt ?? null,
    },
  })
}

beforeEach(async () => {
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

describe('doctor dashboard API', () => {
  it('returns only assigned-patient aggregates and screened training records', async () => {
    const doctor = await addUser({
      username: 'dashboard.doctor',
      displayName: '看板医生',
      role: 'DOCTOR',
    })
    const patient = await addUser({ username: 'dashboard.patient.one', displayName: '患者甲' })
    const otherDoctor = await addUser({
      username: 'dashboard.other-doctor',
      displayName: '其他医生',
      role: 'DOCTOR',
    })
    const otherPatient = await addUser({
      username: 'dashboard.patient.two',
      displayName: '患者乙',
    })
    await prisma.careAssignment.create({
      data: { clinicianId: doctor.id, patientId: patient.id, status: 'ACTIVE' },
    })
    await prisma.careAssignment.create({
      data: { clinicianId: otherDoctor.id, patientId: otherPatient.id, status: 'ACTIVE' },
    })
    await addCompletedGameRun(patient.id)
    await addCompletedGameRun(otherPatient.id, { gameCode: 'emoji-match' })

    const cookie = await login('dashboard.doctor')
    const response = await request(app)
      .get('/api/doctor/dashboard?range=7d')
      .set('Cookie', cookie)

    assert.equal(response.status, 200)
    assert.match(response.headers['cache-control'], /no-store/)
    assert.equal(response.body.dashboard.range.key, '7d')
    assert.equal(response.body.dashboard.range.timezone, 'UTC')
    assert.equal(response.body.dashboard.stats.assignedPatientCount, 1)
    assert.equal(response.body.dashboard.stats.activePatientCount, 1)
    assert.equal(response.body.dashboard.stats.sessionCount, 1)
    assert.equal(response.body.dashboard.stats.completedSessionCount, 1)
    assert.equal(response.body.dashboard.stats.sessionCompletionRate, 100)
    assert.equal(response.body.dashboard.stats.gameRunCount, 1)
    assert.equal(response.body.dashboard.stats.averageAccuracy, 50)
    assert.equal(response.body.dashboard.stats.averageResponseTimeMs, 750)
    assert.equal(response.body.dashboard.dailyTraining.length, 7)
    assert.equal(response.body.dashboard.gamePerformance[0].gameCode, 'object-naming')
    assert.equal(response.body.dashboard.gamePerformance[0].accuracy, 50)
    assert.equal(response.body.dashboard.recentRecords.length, 1)

    const record = response.body.dashboard.recentRecords[0]
    assert.deepEqual(record.patient, { id: patient.id, displayName: '患者甲' })
    assert.equal(record.gameTitle, '物品命名游戏')
    assert.equal(record.score, 50)
    assert.equal(record.questionCount, 2)
    assert.equal(record.correctCount, 1)
    assert.equal(record.wrongCount, 1)
    assert.equal(record.conversationTurns, undefined)
    assert.doesNotMatch(
      JSON.stringify(response.body),
      /PRIVATE_(SESSION_DATA|MEMORY|CONFIG|QUESTION|ANSWER|ATTEMPT|TRANSCRIPT)/,
    )
  })

  it('enforces doctor access and validates the dashboard range', async () => {
    await addUser({ username: 'dashboard.access-patient' })
    const patientCookie = await login('dashboard.access-patient')

    const unauthenticated = await request(app).get('/api/doctor/dashboard')
    assert.equal(unauthenticated.status, 401)
    assert.equal(unauthenticated.body.error.code, 'AUTHENTICATION_REQUIRED')

    const forbidden = await request(app)
      .get('/api/doctor/dashboard')
      .set('Cookie', patientCookie)
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body.error.code, 'ROLE_REQUIRED')

    await addUser({ username: 'dashboard.access-doctor', role: 'DOCTOR' })
    const doctorCookie = await login('dashboard.access-doctor')
    const invalidRange = await request(app)
      .get('/api/doctor/dashboard?range=365d')
      .set('Cookie', doctorCookie)
    assert.equal(invalidRange.status, 400)
    assert.equal(invalidRange.body.error.code, 'VALIDATION_ERROR')
  })

  it('paginates and filters training records within the doctor assignment scope', async () => {
    const doctor = await addUser({ username: 'records.doctor', role: 'DOCTOR' })
    const patient = await addUser({ username: 'records.patient', displayName: '记录患者' })
    const otherDoctor = await addUser({ username: 'records.other-doctor', role: 'DOCTOR' })
    const otherPatient = await addUser({ username: 'records.other-patient', displayName: '其他患者' })
    await prisma.careAssignment.create({
      data: { clinicianId: doctor.id, patientId: patient.id, status: 'ACTIVE' },
    })
    await prisma.careAssignment.create({
      data: { clinicianId: otherDoctor.id, patientId: otherPatient.id, status: 'ACTIVE' },
    })

    const first = await addCompletedGameRun(patient.id, {
      gameCode: 'object-naming',
      startedAt: new Date(Date.now() - 10 * 60 * 1_000),
    })
    const second = await addCompletedGameRun(patient.id, {
      gameCode: 'emoji-match',
      startedAt: new Date(Date.now() - 2 * 60 * 1_000),
    })
    const externalRecord = await addCompletedGameRun(otherPatient.id, {
      gameCode: 'color-line',
      startedAt: new Date(Date.now() - 60 * 1_000),
    })

    const cookie = await login('records.doctor')
    const pageOne = await request(app)
      .get('/api/doctor/training-records?limit=1')
      .set('Cookie', cookie)

    assert.equal(pageOne.status, 200)
    assert.equal(pageOne.body.records.length, 1)
    assert.equal(pageOne.body.records[0].id, second.gameRuns[0].id)
    assert.equal(pageOne.body.records[0].patient.displayName, '记录患者')
    assert.equal(pageOne.body.page.nextCursor, second.gameRuns[0].id)

    const pageTwo = await request(app)
      .get(`/api/doctor/training-records?limit=1&cursor=${pageOne.body.page.nextCursor}`)
      .set('Cookie', cookie)
    assert.equal(pageTwo.status, 200)
    assert.equal(pageTwo.body.records.length, 1)
    assert.equal(pageTwo.body.records[0].id, first.gameRuns[0].id)
    assert.equal(pageTwo.body.page.nextCursor, null)

    const externalCursor = await request(app)
      .get(`/api/doctor/training-records?cursor=${externalRecord.gameRuns[0].id}`)
      .set('Cookie', cookie)
    assert.equal(externalCursor.status, 400)
    assert.equal(externalCursor.body.error.code, 'INVALID_TRAINING_RECORD_CURSOR')

    const filtered = await request(app)
      .get('/api/doctor/training-records?q=表情')
      .set('Cookie', cookie)
    assert.equal(filtered.status, 200)
    assert.deepEqual(filtered.body.records.map((record) => record.id), [second.gameRuns[0].id])
  })

  it('lists assigned patients and returns a screened patient overview', async () => {
    const doctor = await addUser({ username: 'patients.doctor', role: 'DOCTOR' })
    const patient = await addUser({ username: 'patients.patient', displayName: '概览患者' })
    const otherDoctor = await addUser({ username: 'patients.other-doctor', role: 'DOCTOR' })
    const otherPatient = await addUser({
      username: 'patients.other-patient',
      displayName: '其他患者',
    })
    const assignment = await prisma.careAssignment.create({
      data: { clinicianId: doctor.id, patientId: patient.id, status: 'ACTIVE' },
    })
    const otherAssignment = await prisma.careAssignment.create({
      data: { clinicianId: otherDoctor.id, patientId: otherPatient.id, status: 'ACTIVE' },
    })
    const session = await addCompletedGameRun(patient.id, { gameCode: 'emoji-match' })
    await addCompletedGameRun(otherPatient.id, { gameCode: 'color-line' })
    await prisma.sessionSummary.create({
      data: {
        sessionId: session.id,
        status: 'READY',
        resultJson: JSON.stringify({
          sessionOverview: '完成一次表情匹配训练。',
          interactionSummary: '记录到两轮作答。',
          comparisonWithinSession: '本摘要仅描述本次可观察数据。',
          observedLanguageBehavior: ['PRIVATE_TRANSCRIPT'],
        }),
      },
    })
    for (let index = 0; index < 6; index += 1) {
      const startedAt = new Date(Date.now() - (30 + index) * 60 * 1_000)
      await prisma.trainingSession.create({
        data: {
          userId: patient.id,
          status: 'COMPLETED',
          startedAt,
          endedAt: new Date(startedAt.getTime() + 60 * 1_000),
        },
      })
    }

    const cookie = await login('patients.doctor')
    const list = await request(app)
      .get('/api/doctor/patients?limit=1&q=概览')
      .set('Cookie', cookie)

    assert.equal(list.status, 200)
    assert.equal(list.body.page.total, 1)
    assert.equal(list.body.patients.length, 1)
    assert.equal(list.body.patients[0].id, patient.id)
    assert.equal(list.body.patients[0].displayName, '概览患者')
    assert.equal(list.body.patients[0].assignment.id, assignment.id)
    assert.equal(list.body.patients[0].lastTraining.gameCode, 'emoji-match')
    assert.equal(list.body.patients[0].lastTraining.accuracy, 50)
    assert.equal(list.body.patients[0].trainingStatus.code, 'RECENTLY_ACTIVE')

    const overview = await request(app)
      .get(`/api/doctor/patients/${patient.id}/overview?range=7d`)
      .set('Cookie', cookie)

    assert.equal(overview.status, 200)
    assert.equal(overview.body.patient.id, patient.id)
    assert.equal(overview.body.stats.sessionCount, 7)
    assert.equal(overview.body.stats.completedSessionCount, 7)
    assert.equal(overview.body.stats.gameRunCount, 1)
    assert.equal(overview.body.stats.averageAccuracy, 50)
    assert.equal(overview.body.gamePerformance[0].gameCode, 'emoji-match')
    assert.equal(overview.body.recentSessionSummaries.length, 6)
    assert.deepEqual(overview.body.recentSessionSummaries[0].summary, {
      sessionOverview: '完成一次表情匹配训练。',
      interactionSummary: '记录到两轮作答。',
      comparisonWithinSession: '本摘要仅描述本次可观察数据。',
    })
    assert.doesNotMatch(JSON.stringify(overview.body), /PRIVATE_(TRANSCRIPT|SESSION_DATA|MEMORY)/)

    const invalidCursor = await request(app)
      .get(`/api/doctor/patients?cursor=${otherAssignment.id}`)
      .set('Cookie', cookie)
    assert.equal(invalidCursor.status, 400)
    assert.equal(invalidCursor.body.error.code, 'INVALID_PATIENT_CURSOR')

    const denied = await request(app)
      .get(`/api/doctor/patients/${otherPatient.id}/overview`)
      .set('Cookie', cookie)
    assert.equal(denied.status, 403)
    assert.equal(denied.body.error.code, 'PATIENT_ACCESS_DENIED')
  })

  it('lets a doctor link a registered patient and maintain the assigned patient profile', async () => {
    const doctor = await addUser({
      username: 'profile.doctor',
      displayName: '档案医生',
      role: 'DOCTOR',
    })
    const patient = await addUser({
      username: 'profile.patient',
      displayName: '档案患者',
    })
    await addUser({ username: 'profile.other-doctor', role: 'DOCTOR' })

    const doctorCookie = await login(doctor.username)
    const linked = await request(app)
      .post('/api/doctor/patients')
      .set('Cookie', doctorCookie)
      .send({ username: 'PROFILE.PATIENT' })

    assert.equal(linked.status, 201)
    assert.equal(linked.body.assignment.status, 'ACTIVE')
    assert.equal(linked.body.assignment.patient.id, patient.id)
    assert.equal(linked.body.assignment.patient.username, 'profile.patient')
    assert.deepEqual(linked.body.assignment.patient.profile, {
      age: null,
      gender: null,
      diagnosis: null,
      caseNotes: null,
      updatedAt: null,
    })

    const duplicate = await request(app)
      .post('/api/doctor/patients')
      .set('Cookie', doctorCookie)
      .send({ username: 'profile.patient' })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.error.code, 'PATIENT_ALREADY_ASSIGNED')

    const missing = await request(app)
      .post('/api/doctor/patients')
      .set('Cookie', doctorCookie)
      .send({ username: 'missing.patient' })
    assert.equal(missing.status, 404)
    assert.equal(missing.body.error.code, 'PATIENT_ACCOUNT_NOT_FOUND')

    const updated = await request(app)
      .patch(`/api/doctor/patients/${patient.id}/profile`)
      .set('Cookie', doctorCookie)
      .send({
        age: 8,
        gender: 'FEMALE',
        diagnosis: '语言表达训练观察',
        caseNotes: '每周复查训练记录。',
      })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.profile.age, 8)
    assert.equal(updated.body.profile.gender, 'FEMALE')
    assert.equal(updated.body.profile.diagnosis, '语言表达训练观察')
    assert.ok(updated.body.profile.updatedAt)

    const patients = await request(app)
      .get('/api/doctor/patients?q=profile.patient')
      .set('Cookie', doctorCookie)
    assert.equal(patients.status, 200)
    assert.equal(patients.body.page.total, 1)
    assert.equal(patients.body.patients[0].username, 'profile.patient')
    assert.deepEqual(
      {
        age: patients.body.patients[0].profile.age,
        gender: patients.body.patients[0].profile.gender,
        diagnosis: patients.body.patients[0].profile.diagnosis,
        caseNotes: patients.body.patients[0].profile.caseNotes,
      },
      {
        age: 8,
        gender: 'FEMALE',
        diagnosis: '语言表达训练观察',
        caseNotes: '每周复查训练记录。',
      },
    )

    const otherDoctorCookie = await login('profile.other-doctor')
    const denied = await request(app)
      .patch(`/api/doctor/patients/${patient.id}/profile`)
      .set('Cookie', otherDoctorCookie)
      .send({ age: 9 })
    assert.equal(denied.status, 403)
    assert.equal(denied.body.error.code, 'PATIENT_ACCESS_DENIED')

    const blockedOrigin = await request(app)
      .patch(`/api/doctor/patients/${patient.id}/profile`)
      .set('Cookie', doctorCookie)
      .set('Origin', 'https://evil.example')
      .send({ age: 9 })
    assert.equal(blockedOrigin.status, 403)
    assert.equal(blockedOrigin.body.error.code, 'ORIGIN_NOT_ALLOWED')
  })

  it('uses the globally latest game run as each patient\'s last training record', async () => {
    const doctor = await addUser({ username: 'latest.doctor', role: 'DOCTOR' })
    const patient = await addUser({ username: 'latest.patient' })
    await prisma.careAssignment.create({
      data: { clinicianId: doctor.id, patientId: patient.id, status: 'ACTIVE' },
    })

    const olderSession = await addCompletedGameRun(patient.id, {
      gameCode: 'object-naming',
      startedAt: new Date(Date.now() - 30 * 60 * 1_000),
    })
    await prisma.trainingSession.update({
      where: { id: olderSession.id },
      data: { status: 'ACTIVE', endedAt: null },
    })
    await addCompletedGameRun(patient.id, {
      gameCode: 'emoji-match',
      startedAt: new Date(Date.now() - 10 * 60 * 1_000),
    })
    const actualLatestRun = await addGameRunToSession(olderSession.id, {
      gameCode: 'color-line',
      startedAt: new Date(Date.now() - 2 * 60 * 1_000),
    })

    const cookie = await login('latest.doctor')
    const response = await request(app)
      .get('/api/doctor/patients')
      .set('Cookie', cookie)

    assert.equal(response.status, 200)
    assert.equal(response.body.patients[0].lastTraining.id, actualLatestRun.id)
    assert.equal(response.body.patients[0].lastTraining.gameCode, 'color-line')
    assert.equal(response.body.patients[0].trainingStatus.code, 'TRAINING_IN_PROGRESS')
  })

  it('uses the response time as the duration of active game runs', async () => {
    const doctor = await addUser({ username: 'duration.doctor', role: 'DOCTOR' })
    const patient = await addUser({ username: 'duration.patient' })
    await prisma.careAssignment.create({
      data: { clinicianId: doctor.id, patientId: patient.id, status: 'ACTIVE' },
    })

    const startedAt = new Date(Date.now() - 2 * 60 * 1_000)
    const session = await addCompletedGameRun(patient.id, { startedAt })
    const gameRun = session.gameRuns[0]
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { status: 'ACTIVE', endedAt: null },
    })
    await prisma.gameRun.update({
      where: { id: gameRun.id },
      data: { status: 'ACTIVE', endedAt: null },
    })

    const cookie = await login('duration.doctor')
    const minimumDurationMs = 90 * 1_000
    const dashboard = await request(app)
      .get('/api/doctor/dashboard?range=7d')
      .set('Cookie', cookie)
    const records = await request(app)
      .get('/api/doctor/training-records')
      .set('Cookie', cookie)
    const patients = await request(app)
      .get('/api/doctor/patients')
      .set('Cookie', cookie)
    const overview = await request(app)
      .get(`/api/doctor/patients/${patient.id}/overview?range=7d`)
      .set('Cookie', cookie)

    assert.equal(dashboard.status, 200)
    assert.ok(dashboard.body.dashboard.stats.totalTrainingDurationMs >= minimumDurationMs)
    assert.ok(dashboard.body.dashboard.gamePerformance[0].durationMs >= minimumDurationMs)
    assert.ok(dashboard.body.dashboard.recentRecords[0].durationMs >= minimumDurationMs)
    assert.ok(dashboard.body.dashboard.dailyTraining.some((day) => day.durationMs >= minimumDurationMs))
    assert.equal(records.status, 200)
    assert.ok(records.body.records[0].durationMs >= minimumDurationMs)
    assert.equal(patients.status, 200)
    assert.ok(patients.body.patients[0].lastTraining.durationMs >= minimumDurationMs)
    assert.equal(overview.status, 200)
    assert.ok(overview.body.stats.totalTrainingDurationMs >= minimumDurationMs)
    assert.ok(overview.body.recentRecords[0].durationMs >= minimumDurationMs)
  })

  it('lists only screened conversation summaries for assigned patients', async () => {
    const doctor = await addUser({ username: 'conversations.doctor', role: 'DOCTOR' })
    const patient = await addUser({
      username: 'conversations.patient',
      displayName: '对话患者',
    })
    const otherDoctor = await addUser({
      username: 'conversations.other-doctor',
      role: 'DOCTOR',
    })
    const otherPatient = await addUser({
      username: 'conversations.other-patient',
      displayName: '其他对话患者',
    })
    await prisma.careAssignment.create({
      data: { clinicianId: doctor.id, patientId: patient.id, status: 'ACTIVE' },
    })
    await prisma.careAssignment.create({
      data: { clinicianId: otherDoctor.id, patientId: otherPatient.id, status: 'ACTIVE' },
    })
    const olderSession = await addCompletedGameRun(patient.id, {
      startedAt: new Date(Date.now() - 20 * 60 * 1_000),
    })
    const latestSession = await addCompletedGameRun(patient.id, {
      startedAt: new Date(Date.now() - 5 * 60 * 1_000),
    })
    const externalSession = await addCompletedGameRun(otherPatient.id)
    const userTurn = await prisma.conversationTurn.findFirstOrThrow({
      where: { sessionId: latestSession.id },
    })
    const assistantTurn = await prisma.conversationTurn.create({
      data: {
        sessionId: latestSession.id,
        sequence: 2,
        role: 'ASSISTANT',
        context: 'CHAT',
        content: '完整的 AI 回复',
        inputMethod: 'SYSTEM',
        responseLatencyMs: 321,
        metadataJson: JSON.stringify({ emotion: 'empathetic' }),
      },
    })
    await prisma.aiInteraction.create({
      data: {
        sessionId: latestSession.id,
        clientRequestId: 'doctor-detail-interaction',
        trigger: 'USER_MESSAGE',
        context: 'CHAT',
        provider: 'qwen',
        model: 'qwen-plus-character',
        promptVersion: 'patient-interaction-v1',
        status: 'READY',
        userTurnId: userTurn.id,
        assistantTurnId: assistantTurn.id,
      },
    })
    await prisma.sessionSummary.create({
      data: {
        sessionId: latestSession.id,
        status: 'READY',
        resultJson: JSON.stringify({
          sessionOverview: '完成一次训练会话。',
          interactionSummary: '记录到一次用户互动。',
          comparisonWithinSession: '仅描述本次可观察数据。',
          observedLanguageBehavior: ['PRIVATE_TRANSCRIPT'],
        }),
      },
    })

    const cookie = await login('conversations.doctor')
    const pageOne = await request(app)
      .get('/api/doctor/conversations?limit=1&q=对话')
      .set('Cookie', cookie)

    assert.equal(pageOne.status, 200)
    assert.equal(pageOne.body.page.total, 2)
    assert.equal(pageOne.body.conversations.length, 1)
    assert.equal(pageOne.body.conversations[0].id, latestSession.id)
    assert.deepEqual(pageOne.body.conversations[0].patient, {
      id: patient.id,
      displayName: '对话患者',
    })
    assert.equal(pageOne.body.conversations[0].turnCount, 2)
    assert.deepEqual(pageOne.body.conversations[0].contexts, [{ code: 'CHAT', title: '日常交流' }])
    assert.deepEqual(pageOne.body.conversations[0].summary, {
      sessionOverview: '完成一次训练会话。',
      interactionSummary: '记录到一次用户互动。',
      comparisonWithinSession: '仅描述本次可观察数据。',
    })
    assert.doesNotMatch(JSON.stringify(pageOne.body), /PRIVATE_(TRANSCRIPT|SESSION_DATA|MEMORY)/)

    const detail = await request(app)
      .get(`/api/doctor/conversations/${latestSession.id}`)
      .set('Cookie', cookie)
    assert.equal(detail.status, 200)
    assert.deepEqual(
      detail.body.conversation.turns.map((turn) => ({
        sequence: turn.sequence,
        role: turn.role,
        content: turn.content,
      })),
      [
        { sequence: 1, role: 'USER', content: 'PRIVATE_TRANSCRIPT' },
        { sequence: 2, role: 'ASSISTANT', content: '完整的 AI 回复' },
      ],
    )
    assert.equal(detail.body.conversation.turns[1].emotion, 'empathetic')
    assert.deepEqual(detail.body.conversation.turns[1].ai, {
      interactionId: detail.body.conversation.turns[1].ai.interactionId,
      status: 'READY',
      trigger: 'USER_MESSAGE',
      provider: 'qwen',
      model: 'qwen-plus-character',
      promptVersion: 'patient-interaction-v1',
    })

    const pageTwo = await request(app)
      .get(`/api/doctor/conversations?limit=1&cursor=${pageOne.body.page.nextCursor}`)
      .set('Cookie', cookie)
    assert.equal(pageTwo.status, 200)
    assert.equal(pageTwo.body.conversations[0].id, olderSession.id)
    assert.equal(pageTwo.body.conversations[0].summary, null)

    const externalCursor = await request(app)
      .get(`/api/doctor/conversations?cursor=${externalSession.id}`)
      .set('Cookie', cookie)
    assert.equal(externalCursor.status, 400)
    assert.equal(externalCursor.body.error.code, 'INVALID_CONVERSATION_CURSOR')

    const externalDetail = await request(app)
      .get(`/api/doctor/conversations/${externalSession.id}`)
      .set('Cookie', cookie)
    assert.equal(externalDetail.status, 403)
    assert.equal(externalDetail.body.error.code, 'CONVERSATION_ACCESS_DENIED')
  })
})
