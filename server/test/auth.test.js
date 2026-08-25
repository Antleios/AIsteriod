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
