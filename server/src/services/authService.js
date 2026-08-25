import prisma from '../db/prisma.js'
import { authConfig, USER_STATUSES } from '../config/auth.js'
import { createUserSchema } from '../validation/authSchemas.js'
import { hashPassword, verifyPassword } from '../security/password.js'
import {
  createSessionToken,
  hashSessionToken,
} from '../security/sessionToken.js'

const ACTIVE_STATUS = USER_STATUSES[0]
const dummyPasswordHash = hashPassword('not-a-real-aisteriod-password')

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

export async function createUser(input) {
  const data = createUserSchema.parse(input)
  const passwordHash = await hashPassword(data.password)

  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      displayName: data.displayName,
      role: data.role,
    },
  })

  return serializeUser(user)
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
