import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { after, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import prisma from '../src/db/prisma.js'
import { createUser } from '../src/services/authService.js'
import { hashSessionToken } from '../src/security/sessionToken.js'

const app = createApp()
const allowedOrigin = 'http://localhost:5173'
const execFileAsync = promisify(execFile)

async function addPatient(overrides = {}) {
  return createUser({
    username: 'patient.one',
    password: 'correct-horse-battery-staple',
    displayName: '测试患者',
    role: 'PATIENT',
    ...overrides,
  })
}

async function login(username = 'patient.one') {
  return request(app)
    .post('/api/auth/login')
    .set('Origin', allowedOrigin)
    .send({
      username,
      password: 'correct-horse-battery-staple',
    })
}

function sessionCookie(response) {
  return response.headers['set-cookie'][0].split(';')[0]
}

beforeEach(async () => {
  await prisma.authSession.deleteMany()
  await prisma.user.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

describe('authentication API', () => {
  it('registers patients as active accounts and signs them in immediately', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', allowedOrigin)
      .send({
        username: 'Patient.Registered',
        password: 'registered-correct-horse-battery-staple',
        displayName: '新患者',
        role: 'PATIENT',
      })

    assert.equal(response.status, 201)
    assert.equal(response.body.user.username, 'patient.registered')
    assert.equal(response.body.user.role, 'PATIENT')
    assert.equal(response.body.user.status, 'ACTIVE')
    assert.deepEqual(response.body.registration, { requiresApproval: false })
    assert.match(response.headers['set-cookie'][0], /HttpOnly/)

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie(response))
    assert.equal(meResponse.status, 200)
    assert.equal(meResponse.body.user.role, 'PATIENT')

    const duplicate = await request(app)
      .post('/api/auth/register')
      .set('Origin', allowedOrigin)
      .send({
        username: 'patient.registered',
        password: 'registered-correct-horse-battery-staple',
        displayName: '重复患者',
      })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.error.code, 'USERNAME_TAKEN')
  })

  it('keeps doctor registrations pending until an administrator approves them', async () => {
    const doctorRegistration = await request(app)
      .post('/api/auth/register')
      .set('Origin', allowedOrigin)
      .send({
        username: 'doctor.registered',
        password: 'registered-correct-horse-battery-staple',
        displayName: '待审核医生',
        role: 'DOCTOR',
      })

    assert.equal(doctorRegistration.status, 202)
    assert.equal(doctorRegistration.body.user.role, 'DOCTOR')
    assert.equal(doctorRegistration.body.user.status, 'PENDING')
    assert.deepEqual(doctorRegistration.body.registration, { requiresApproval: true })
    assert.equal(doctorRegistration.headers['set-cookie'], undefined)

    const pendingLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .send({
        username: 'doctor.registered',
        password: 'registered-correct-horse-battery-staple',
      })
    assert.equal(pendingLogin.status, 403)
    assert.equal(pendingLogin.body.error.code, 'ACCOUNT_PENDING_APPROVAL')

    const patientRegistration = await request(app)
      .post('/api/auth/register')
      .set('Origin', allowedOrigin)
      .send({
        username: 'patient.forbidden',
        password: 'registered-correct-horse-battery-staple',
        displayName: '普通患者',
      })
    const patientCookie = sessionCookie(patientRegistration)
    const forbiddenList = await request(app)
      .get('/api/auth/admin/doctor-registrations')
      .set('Cookie', patientCookie)
    assert.equal(forbiddenList.status, 403)
    assert.equal(forbiddenList.body.error.code, 'ROLE_REQUIRED')

    await createUser({
      username: 'admin.registration',
      password: 'correct-horse-battery-staple',
      displayName: '审核管理员',
      role: 'ADMIN',
    })
    const adminCookie = sessionCookie(await login('admin.registration'))
    const pendingList = await request(app)
      .get('/api/auth/admin/doctor-registrations')
      .set('Cookie', adminCookie)
    assert.equal(pendingList.status, 200)
    assert.equal(pendingList.body.users.length, 1)
    assert.equal(pendingList.body.users[0].id, doctorRegistration.body.user.id)

    const approved = await request(app)
      .post(`/api/auth/admin/doctor-registrations/${doctorRegistration.body.user.id}/approve`)
      .set('Origin', allowedOrigin)
      .set('Cookie', adminCookie)
    assert.equal(approved.status, 200)
    assert.equal(approved.body.user.status, 'ACTIVE')

    const doctorLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .send({
        username: 'doctor.registered',
        password: 'registered-correct-horse-battery-staple',
      })
    assert.equal(doctorLogin.status, 200)
    assert.equal(doctorLogin.body.user.role, 'DOCTOR')
  })

  it('does not allow public registration of administrators', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', allowedOrigin)
      .send({
        username: 'admin.self-registered',
        password: 'registered-correct-horse-battery-staple',
        displayName: '越权管理员',
        role: 'ADMIN',
      })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  })

  it('creates a normalized account through the administrator command', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        'scripts/create-user.js',
        '--username',
        'Patient.CLI',
        '--display-name',
        '命令行患者',
        '--role',
        'PATIENT',
      ],
      {
        env: {
          ...process.env,
          NEW_USER_PASSWORD: 'cli-correct-horse-battery-staple',
        },
      },
    )

    assert.match(stdout, /patient\.cli/)
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: 'patient.cli' },
    })
    assert.equal(user.displayName, '命令行患者')
    assert.equal(user.role, 'PATIENT')
    assert.match(user.passwordHash, /^\$argon2id\$/)
  })

  it('logs in, stores only a token hash, and returns the current user', async () => {
    await addPatient()

    const loginResponse = await login()
    assert.equal(loginResponse.status, 200)
    assert.equal(loginResponse.body.user.username, 'patient.one')
    assert.equal(loginResponse.body.user.passwordHash, undefined)
    assert.match(loginResponse.headers['cache-control'], /no-store/)
    assert.match(loginResponse.headers['set-cookie'][0], /HttpOnly/)
    assert.match(loginResponse.headers['set-cookie'][0], /SameSite=Lax/)

    const cookie = sessionCookie(loginResponse)
    const rawToken = cookie.split('=')[1]
    const storedSession = await prisma.authSession.findFirstOrThrow()
    assert.notEqual(storedSession.tokenHash, rawToken)
    assert.equal(storedSession.tokenHash, hashSessionToken(rawToken))

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)

    assert.equal(meResponse.status, 200)
    assert.equal(meResponse.body.user.displayName, '测试患者')
    assert.equal(meResponse.body.user.passwordHash, undefined)
  })

  it('uses one generic response for wrong passwords and unknown users', async () => {
    await addPatient()

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .send({ username: 'patient.one', password: 'this-password-is-wrong' })
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .send({ username: 'missing.user', password: 'this-password-is-wrong' })

    assert.equal(wrongPassword.status, 401)
    assert.equal(unknownUser.status, 401)
    assert.deepEqual(wrongPassword.body, unknownUser.body)
  })

  it('rejects disabled users and invalid request bodies', async () => {
    const user = await addPatient()
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'DISABLED' },
    })

    const disabledResponse = await login()
    assert.equal(disabledResponse.status, 401)

    const invalidResponse = await request(app)
      .post('/api/auth/login')
      .set('Origin', allowedOrigin)
      .send({ username: 'x', password: 'short', extra: true })
    assert.equal(invalidResponse.status, 400)
    assert.equal(invalidResponse.body.error.code, 'VALIDATION_ERROR')
  })

  it('logs out idempotently and revokes the current session', async () => {
    await addPatient()
    const loginResponse = await login()
    const cookie = sessionCookie(loginResponse)

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Origin', allowedOrigin)
      .set('Cookie', cookie)
    assert.equal(logoutResponse.status, 204)

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)
    assert.equal(meResponse.status, 401)

    const secondLogout = await request(app)
      .post('/api/auth/logout')
      .set('Origin', allowedOrigin)
    assert.equal(secondLogout.status, 204)
  })

  it('revokes all sessions for the authenticated user', async () => {
    await addPatient()
    const firstCookie = sessionCookie(await login())
    const secondCookie = sessionCookie(await login())

    const logoutAllResponse = await request(app)
      .post('/api/auth/logout-all')
      .set('Origin', allowedOrigin)
      .set('Cookie', firstCookie)
    assert.equal(logoutAllResponse.status, 204)

    for (const cookie of [firstCookie, secondCookie]) {
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie)
      assert.equal(meResponse.status, 401)
    }
  })

  it('rejects expired sessions and disallowed browser origins', async () => {
    await addPatient()
    const loginResponse = await login()
    const cookie = sessionCookie(loginResponse)
    await prisma.authSession.updateMany({
      data: { expiresAt: new Date(0) },
    })

    const expiredResponse = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)
    assert.equal(expiredResponse.status, 401)

    const originResponse = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://attacker.example')
      .send({
        username: 'patient.one',
        password: 'correct-horse-battery-staple',
      })
    assert.equal(originResponse.status, 403)
    assert.equal(originResponse.body.error.code, 'ORIGIN_NOT_ALLOWED')
  })

  it('keeps the health endpoint public', async () => {
    const response = await request(app).get('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
  })

  it('keeps all existing game endpoints public and operational', async () => {
    const endpoints = [
      '/api/games',
      '/api/games/object-naming/questions',
      '/api/games/emoji-match/questions',
      '/api/games/color-line/round',
    ]

    for (const endpoint of endpoints) {
      const response = await request(app).get(endpoint)
      assert.equal(response.status, 200, endpoint)
    }
  })
})
