import prisma from '../db/prisma.js'
import { generatePatientInteractionReply } from './aiService.js'
import {
  createPatientInteractionInput,
  sessionConversationMemoryOutputSchema,
} from '../validation/aiSchemas.js'

const ACTIVE_SESSION = 'ACTIVE'
const MAX_RECENT_TURNS = 10

export class AiInteractionError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function json(value) {
  return value === undefined ? null : JSON.stringify(value)
}

function parseJson(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function parsePreviousSessionMemory(value) {
  const parsed = sessionConversationMemoryOutputSchema.safeParse(parseJson(value, null))
  return parsed.success ? parsed.data : null
}

function assertPatient(user) {
  if (user.role !== 'PATIENT') {
    throw new AiInteractionError(403, 'PATIENT_ROLE_REQUIRED', '仅患者可以进行训练互动')
  }
}

function assertActiveSession(session) {
  if (!session) {
    throw new AiInteractionError(404, 'SESSION_NOT_FOUND', '训练会话不存在')
  }
  if (session.status !== ACTIVE_SESSION) {
    throw new AiInteractionError(409, 'SESSION_NOT_ACTIVE', '训练会话已经结束，不能继续互动')
  }
}

function serializeInteraction(interaction) {
  const result = parseJson(interaction.resultJson, null)
  return {
    id: interaction.id,
    status: interaction.status,
    reply: result?.reply ?? null,
    emotion: result?.emotion ?? null,
    output: result,
    provider: interaction.provider,
    model: interaction.model,
    prompt: {
      id: 'patient-interaction',
      version: interaction.promptVersion,
    },
    promptVersion: interaction.promptVersion,
  }
}

async function assertGameRun(sessionId, gameRunId) {
  if (!gameRunId) return
  const gameRun = await prisma.gameRun.findFirst({
    where: { id: gameRunId, sessionId },
    select: { id: true },
  })
  if (!gameRun) {
    throw new AiInteractionError(400, 'INVALID_GAME_RUN', '游戏轮次不属于该训练会话')
  }
}

async function createConversationTurn(tx, sessionId, data) {
  const updated = await tx.trainingSession.update({
    where: { id: sessionId },
    data: { nextConversationSequence: { increment: 1 } },
    select: { nextConversationSequence: true },
  })
  return tx.conversationTurn.create({
    data: {
      sessionId,
      sequence: updated.nextConversationSequence - 1,
      ...data,
    },
  })
}

async function getRecentConversation(sessionId) {
  const turns = await prisma.conversationTurn.findMany({
    where: { sessionId },
    orderBy: { sequence: 'desc' },
    take: MAX_RECENT_TURNS,
    select: { role: true, content: true, context: true },
  })

  return turns.reverse().map((turn) => ({
    role: turn.role === 'USER' ? 'user' : 'assistant',
    content: turn.content,
    context: turn.context,
  }))
}

export async function createSessionInteraction(user, sessionId, input) {
  assertPatient(user)

  const existing = await prisma.aiInteraction.findUnique({
    where: {
      sessionId_clientRequestId: {
        sessionId,
        clientRequestId: input.clientRequestId,
      },
    },
  })
  if (existing?.status === 'READY') return serializeInteraction(existing)
  if (existing) {
    throw new AiInteractionError(
      409,
      'AI_INTERACTION_NOT_READY',
      '该互动请求正在处理或已失败，请使用新的请求 ID 重试',
    )
  }

  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, userId: user.id },
  })
  assertActiveSession(session)
  await assertGameRun(sessionId, input.gameRunId)

  const interaction = await prisma.$transaction(async (tx) => {
    const created = await tx.aiInteraction.create({
      data: {
        sessionId,
        clientRequestId: input.clientRequestId,
        gameRunId: input.gameRunId,
        trigger: input.trigger,
        context: input.context,
        requestJson: json({
          schemaVersion: 'ai-interaction-request.v1',
          clientRequestId: input.clientRequestId,
          trigger: input.trigger,
          context: input.context,
          gameRunId: input.gameRunId ?? null,
          userText: input.userText ?? null,
          inputMethod: input.inputMethod,
          gameState: input.gameState ?? null,
        }),
      },
    })

    if (!input.userText) return created

    const userTurn = await createConversationTurn(tx, sessionId, {
      role: 'USER',
      context: input.context,
      content: input.userText,
      inputMethod: input.inputMethod,
      isUserInitiated: input.context === 'CHAT',
      metadataJson: json({ aiInteractionId: created.id, trigger: input.trigger }),
    })
    return tx.aiInteraction.update({
      where: { id: created.id },
      data: { userTurnId: userTurn.id },
    })
  })

  try {
    const llmInput = createPatientInteractionInput({
      trigger: input.trigger,
      context: input.context,
      gameState: input.gameState,
      userText: input.userText,
      inputMethod: input.inputMethod,
      previousSessionMemory:
        session.nextConversationSequence === 1
          ? parsePreviousSessionMemory(session.previousConversationMemoryJson)
          : null,
      recentConversation: await getRecentConversation(sessionId),
    })
    const generated = await generatePatientInteractionReply(llmInput)
    await prisma.aiInteraction.update({
      where: { id: interaction.id },
      data: {
        requestJson: json({
          ...llmInput,
          prompt: generated.prompt,
        }),
      },
    })
    const completed = await prisma.$transaction(async (tx) => {
      const activeSession = await tx.trainingSession.findFirst({
        where: { id: sessionId, userId: user.id },
      })
      assertActiveSession(activeSession)
      const assistantTurn = await createConversationTurn(tx, sessionId, {
        role: 'ASSISTANT',
        context: input.context,
        content: generated.output.reply,
        inputMethod: 'SYSTEM',
        isUserInitiated: false,
        metadataJson: json({
          aiInteractionId: interaction.id,
          emotion: generated.output.emotion,
          trigger: input.trigger,
        }),
      })
      return tx.aiInteraction.update({
        where: { id: interaction.id },
        data: {
          status: 'READY',
          provider: generated.provider,
          model: generated.model,
          promptVersion: generated.prompt.version,
          resultJson: json(generated.output),
          assistantTurnId: assistantTurn.id,
          errorMessage: null,
        },
      })
    })
    return serializeInteraction(completed)
  } catch (error) {
    await prisma.aiInteraction.update({
      where: { id: interaction.id },
      data: {
        status: 'FAILED',
        errorMessage: '互动回复生成失败，请稍后重试',
      },
    })
    if (error instanceof AiInteractionError) throw error
    throw new AiInteractionError(502, 'AI_INTERACTION_FAILED', '互动回复生成失败，请稍后重试')
  }
}
