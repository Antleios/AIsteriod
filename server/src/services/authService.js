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
  // 内部版：医生注册与患者一致，直接激活并自动登录，无需管理员审核
  return persistUser(registerUserSchema.parse(input))
}

export async function loginWithPassword({ username, password }) {
  const user = await prisma.user.findUnique({
    where: { username },
  })
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash)
  const passwordMatches = await verifyPassword(passwordHash, password)

  if (!user || !passwordMatches || user.status !== ACTIVE_STATUS) {
    return null
  }

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
