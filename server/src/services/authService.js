import prisma from '../db/prisma.js'
import { authConfig, USER_STATUSES } from '../config/auth.js'
import {
  createUserSchema,
  registerUserSchema,
} from '../validation/authSchemas.js'
import { hashPassword, verifyPassword } from '../security/password.js'
import {
  createSessionToken,
  hashSessionToken,
} from '../security/sessionToken.js'

const PENDING_STATUS = USER_STATUSES[0]
const ACTIVE_STATUS = USER_STATUSES[1]
const dummyPasswordHash = hashPassword('not-a-real-aisteriod-password')

export class AuthError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

async function persistUser(data, status = ACTIVE_STATUS) {
  const existingUser = await prisma.user.findUnique({
    where: { username: data.username },
    select: { id: true },
  })
  if (existingUser) {
    throw new AuthError(409, 'USERNAME_TAKEN', '用户名已被使用')
  }

  const passwordHash = await hashPassword(data.password)

  try {
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        displayName: data.displayName,
        role: data.role,
        status,
      },
    })

    return serializeUser(user)
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new AuthError(409, 'USERNAME_TAKEN', '用户名已被使用')
    }

    throw error
  }
}

export async function createUser(input) {
  return persistUser(createUserSchema.parse(input))
}

export async function registerUser(input) {
  const data = registerUserSchema.parse(input)
  const status = data.role === 'DOCTOR' ? PENDING_STATUS : ACTIVE_STATUS

  return persistUser(data, status)
}

export async function listPendingDoctorRegistrations() {
  const users = await prisma.user.findMany({
    where: { role: 'DOCTOR', status: PENDING_STATUS },
    orderBy: { createdAt: 'asc' },
  })

  return users.map(serializeUser)
}

export async function approveDoctorRegistration(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user || user.role !== 'DOCTOR') {
    throw new AuthError(404, 'DOCTOR_REGISTRATION_NOT_FOUND', '待审核医生不存在')
  }
  if (user.status === 'DISABLED') {
    throw new AuthError(409, 'ACCOUNT_DISABLED', '已禁用账号不能审核通过')
  }
  if (user.status === ACTIVE_STATUS) return serializeUser(user)

  return serializeUser(
    await prisma.user.update({
      where: { id: user.id },
      data: { status: ACTIVE_STATUS },
    }),
  )
}

export async function loginWithPassword({ username, password }) {
  const user = await prisma.user.findUnique({
    where: { username },
  })
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash)
  const passwordMatches = await verifyPassword(passwordHash, password)

  if (!user || !passwordMatches || user.status === 'DISABLED') {
    return null
  }
  if (user.status === PENDING_STATUS) return { pendingApproval: true }
  if (user.status !== ACTIVE_STATUS) return null

  const now = new Date()
  const expiresAt = new Date(now.getTime() + authConfig.sessionTtlMs)
  const { token, tokenHash } = createSessionToken()

  const [, , updatedUser] = await prisma.$transaction([
    prisma.authSession.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lte: now } },
          { revokedAt: { not: null } },
        ],
      },
    }),
    prisma.authSession.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    }),
  ])

  return {
    token,
    expiresAt,
    user: serializeUser(updatedUser),
  }
}

export async function getAuthenticatedSession(token) {
  if (!token) return null

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  })

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== ACTIVE_STATUS
  ) {
    return null
  }

  return {
    sessionId: session.id,
    user: serializeUser(session.user),
  }
}

export async function revokeSession(token) {
  if (!token) return

  await prisma.authSession.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllUserSessions(userId) {
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })
}
