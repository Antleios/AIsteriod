import { randomInt } from 'node:crypto'
import prisma from '../db/prisma.js'
import { buildEmojiMatchQuestions } from './gamesService.js'
import {
  generateDoctorSummary,
  generateSessionConversationMemory,
} from './aiService.js'
import { createSessionConversationMemoryInput } from '../validation/aiSchemas.js'

const GAME_DEFINITIONS = {
  'object-naming': { title: '物品命名游戏', questionCount: 10 },
  'emoji-match': { title: '表情匹配游戏', questionCount: 8 },
  'color-line': { title: '颜色连线游戏', questionCount: 5 },
}

const ACTIVE_SESSION = 'ACTIVE'
const ACTIVE_RUN = 'ACTIVE'

export class TrainingError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function shuffle(items) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

function parseJson(value, fallback = null) {
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function json(value) {
  return value === undefined ? null : JSON.stringify(value)
}

function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('zh-CN')
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function assertPatient(user) {
  if (user.role !== 'PATIENT') {
    throw new TrainingError(403, 'PATIENT_ROLE_REQUIRED', '仅患者可以创建训练会话')
  }
}

function assertRole(user, role, message) {
  if (user.role !== role) {
    throw new TrainingError(403, `${role}_ROLE_REQUIRED`, message)
  }
}

function assertActiveSession(session) {
  if (!session) {
    throw new TrainingError(404, 'SESSION_NOT_FOUND', '训练会话不存在')
  }

  if (session.status !== ACTIVE_SESSION) {
    throw new TrainingError(409, 'SESSION_NOT_ACTIVE', '训练会话已经结束，不能继续写入')
  }
}

async function claimActiveSession(tx, userId, sessionId) {
  const claimed = await tx.trainingSession.updateMany({
    where: { id: sessionId, userId, status: ACTIVE_SESSION },
    data: { updatedAt: new Date() },
  })

  if (claimed.count) return

  const session = await tx.trainingSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true },
  })
  assertActiveSession(session)
}

function serializeQuestion(question) {
  return {
    id: question.id,
    position: question.position,
    type: question.questionType,
    ...parseJson(question.clientPayloadJson, {}),
    completedAt: question.completedAt,
  }
}

function serializeGameRun(run, includeQuestions = false) {
  return {
    id: run.id,
    sessionId: run.sessionId,
    gameCode: run.gameCode,
    sequence: run.sequence,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    config: parseJson(run.configSnapshotJson, null),
    ...(includeQuestions
      ? { questions: run.questions.map(serializeQuestion) }
      : {}),
  }
}

function serializeConversationTurn(turn) {
  return {
    id: turn.id,
    sequence: turn.sequence,
    role: turn.role,
    context: turn.context,
    content: turn.content,
    inputMethod: turn.inputMethod,
    responseLatencyMs: turn.responseLatencyMs,
    isUserInitiated: turn.isUserInitiated,
    metadata: parseJson(turn.metadataJson, null),
    createdAt: turn.createdAt,
  }
}

function serializeSummary(summary) {
  if (!summary) return null

  return {
    status: summary.status,
    provider: summary.provider,
    promptVersion: summary.promptVersion,
    result: parseJson(summary.resultJson, null),
    errorMessage: summary.errorMessage,
    generatedAt: summary.generatedAt,
  }
}

function serializeSession(session, options = {}) {
  return {
    id: session.id,
    userId: session.userId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    metadata: parseJson(session.metadataJson, null),
    metrics: parseJson(session.metricsJson, null),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ...(options.detail
      ? {
          gameRuns: session.gameRuns.map((run) => serializeGameRun(run, true)),
          conversationTurns: session.conversationTurns.map(serializeConversationTurn),
          interactionEvents: session.interactionEvents.map((event) => ({
            id: event.id,
            gameRunId: event.gameRunId,
            type: event.type,
            occurredAt: event.occurredAt,
            data: parseJson(event.dataJson, null),
          })),
          summary: serializeSummary(session.summary),
        }
      : {}),
  }
}

async function getOwnedSession(userId, sessionId, include = {}) {
  return prisma.trainingSession.findFirst({
    where: { id: sessionId, userId },
    include,
  })
}

async function createObjectNamingQuestions() {
  const sourceQuestions = await prisma.objectNamingQuestion.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  })
  const selected = shuffle(sourceQuestions).slice(
    0,
    GAME_DEFINITIONS['object-naming'].questionCount,
  )

  if (!selected.length) {
    throw new TrainingError(409, 'QUESTION_BANK_EMPTY', '物品命名题库没有可用题目')
  }

  return selected.map((question, index) => ({
    position: index + 1,
    sourceQuestionId: question.id,
    questionType: 'OBJECT_NAMING',
    clientPayloadJson: json({
      prompt: question.prompt,
      hint: question.hint,
      assetType: question.assetType,
      assetValue: question.assetValue,
      difficulty: question.difficulty,
    }),
    answerJson: json({ acceptedAnswers: [normalizeAnswer(question.answer)] }),
  }))
}

async function createEmojiMatchQuestions() {
  const emojis = await prisma.emotionEmoji.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  })
  const questions = buildEmojiMatchQuestions(
    emojis,
    GAME_DEFINITIONS['emoji-match'].questionCount,
  )

  return questions.map((question, index) => {
    const correctOption = question.options.find((option) => option.isCorrect)

    return {
      position: index + 1,
      sourceQuestionId: question.id,
      questionType: 'EMOJI_MATCH',
      clientPayloadJson: json({
        prompt: question.prompt,
        difficulty: question.difficulty,
        options: question.options.map(({ id, label, displayValue }) => ({
          id: String(id),
          label,
          displayValue,
        })),
      }),
      answerJson: json({ correctOptionId: String(correctOption.id) }),
    }
  })
}

async function createColorLineQuestions() {
  const config = await prisma.colorLineConfig.findUnique({
    where: { key: 'default' },
  })
  const palette = parseJson(config?.paletteJson, [])
  const selected = shuffle(palette).slice(0, config?.totalPairs ?? 5)

  if (!config?.isActive || !selected.length) {
    throw new TrainingError(409, 'QUESTION_BANK_EMPTY', '颜色连线配置不可用')
  }

  const rightOptions = shuffle(selected).map((item) => ({
    id: item.color,
    color: item.color,
    label: item.name,
  }))

  return {
    config: {
      title: config.title,
      description: config.description,
      totalPairs: selected.length,
      rightOptions,
    },
    questions: shuffle(selected).map((item, index) => ({
      position: index + 1,
      sourceQuestionId: null,
      questionType: 'COLOR_LINE_PAIR',
      clientPayloadJson: json({
        prompt: '请连接相同颜色的图形',
        color: item.color,
        label: item.name,
        options: rightOptions,
      }),
      answerJson: json({ correctOptionId: item.color }),
    })),
  }
}

function isCorrectAnswer(question, answer) {
  const expected = parseJson(question.answerJson, {})
  const normalized = normalizeAnswer(answer)

  if (Array.isArray(expected.acceptedAnswers)) {
    return expected.acceptedAnswers.includes(normalized)
  }

  return expected.correctOptionId === String(answer ?? '')
}

function computeGameMetrics(gameRuns, events) {
  return gameRuns.map((run) => {
    const attempts = run.questions.flatMap((question) => question.attempts)
    const correctCount = attempts.filter((attempt) => attempt.outcome === 'CORRECT').length
    const wrongCount = attempts.filter((attempt) => attempt.outcome === 'WRONG').length
    const responseTimes = attempts
      .map((attempt) => attempt.responseTimeMs)
      .filter((value) => Number.isInteger(value))
    const runEvents = events.filter((event) => event.gameRunId === run.id)
    const idleEvents = runEvents.filter((event) =>
      ['IDLE', 'LONG_IDLE'].includes(event.type),
    )

    return {
      gameCode: run.gameCode,
      title: GAME_DEFINITIONS[run.gameCode]?.title ?? run.gameCode,
      status: run.status,
      durationMs: (run.endedAt ?? new Date()).getTime() - run.startedAt.getTime(),
      questionCount: run.questions.length,
      totalAttempts: attempts.length,
      correctCount,
      wrongCount,
      revealedCount: attempts.filter((attempt) => attempt.outcome === 'REVEALED').length,
      accuracy: correctCount + wrongCount ? round(correctCount / (correctCount + wrongCount)) : null,
      averageResponseTimeMs: responseTimes.length
        ? round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : null,
      idleCount: idleEvents.length,
      maxIdleDurationMs: Math.max(
        0,
        ...idleEvents.map((event) => Number(parseJson(event.dataJson, {}).idleDurationMs) || 0),
      ),
      completed: run.status === 'COMPLETED',
    }
  })
}

function computeConversationMetrics(turns, events) {
  const userTurns = turns.filter((turn) => turn.role === 'USER')
  const responseLatencies = turns
    .map((turn) => turn.responseLatencyMs)
    .filter((value) => Number.isInteger(value))
  const longPauseCount = events.filter((event) => event.type === 'LONG_IDLE').length

  return {
    turnCount: turns.length,
    userUtteranceCount: userTurns.length,
    averageUtteranceLength: userTurns.length
      ? round(
          userTurns.reduce((sum, turn) => sum + Array.from(turn.content).length, 0) /
            userTurns.length,
          1,
        )
      : null,
    averageResponseLatencyMs: responseLatencies.length
      ? round(responseLatencies.reduce((sum, value) => sum + value, 0) / responseLatencies.length)
      : null,
    longPauseCount,
    userInitiatedCount: userTurns.filter((turn) => turn.isUserInitiated).length,
  }
}

function buildSummaryInput(session) {
  const gameMetrics = computeGameMetrics(session.gameRuns, session.interactionEvents)
  const conversationMetrics = computeConversationMetrics(
    session.conversationTurns,
    session.interactionEvents,
  )
  const relevantTranscript = session.conversationTurns
    .filter((turn) => turn.role === 'USER')
    .slice(-10)
    .map((turn) => ({ context: turn.context, user: turn.content }))

  return {
    sessionId: session.id,
    games: gameMetrics,
    conversationMetrics,
    relevantTranscript,
  }
}

async function getLatestReadyConversationMemory(userId) {
  const memory = await prisma.sessionConversationMemory.findFirst({
    where: {
      status: 'READY',
      resultJson: { not: null },
      session: { userId, status: 'COMPLETED' },
    },
    orderBy: { generatedAt: 'desc' },
    select: { resultJson: true },
  })

  return memory?.resultJson ?? null
}

async function loadSessionDetail(userId, sessionId) {
  const session = await getOwnedSession(userId, sessionId, {
    gameRuns: {
      orderBy: { sequence: 'asc' },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { attempts: { orderBy: { createdAt: 'asc' } } },
        },
      },
    },
    interactionEvents: { orderBy: { occurredAt: 'asc' } },
    conversationTurns: { orderBy: { sequence: 'asc' } },
    summary: true,
  })

  if (!session) {
    throw new TrainingError(404, 'SESSION_NOT_FOUND', '训练会话不存在')
  }

  return session
}

export async function createTrainingSession(user, input) {
  assertPatient(user)
  const previousConversationMemoryJson = await getLatestReadyConversationMemory(user.id)
  const session = await prisma.trainingSession.create({
    data: {
      userId: user.id,
      metadataJson: json(input.metadata),
      previousConversationMemoryJson,
    },
  })

  return serializeSession(session)
}

export async function listTrainingSessions(user) {
  assertPatient(user)
  const sessions = await prisma.trainingSession.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: 'desc' },
    take: 30,
  })

  return sessions.map(serializeSession)
}

export async function getTrainingSession(user, sessionId) {
  assertPatient(user)
  return serializeSession(await loadSessionDetail(user.id, sessionId), { detail: true })
}

export async function createGameRun(user, sessionId, { gameCode }) {
  assertPatient(user)
  const session = await getOwnedSession(user.id, sessionId)
  assertActiveSession(session)

  let questionData
  let configSnapshotJson = null
  if (gameCode === 'object-naming') questionData = await createObjectNamingQuestions()
  if (gameCode === 'emoji-match') questionData = await createEmojiMatchQuestions()
  if (gameCode === 'color-line') {
    const colorRound = await createColorLineQuestions()
    questionData = colorRound.questions
    configSnapshotJson = json(colorRound.config)
  }

  const run = await prisma.$transaction(async (tx) => {
    await claimActiveSession(tx, user.id, sessionId)
    const session = await tx.trainingSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { nextGameRunSequence: true },
    })
    await tx.trainingSession.update({
      where: { id: sessionId },
      data: { nextGameRunSequence: { increment: 1 } },
    })

    return tx.gameRun.create({
      data: {
        sessionId,
        gameCode,
        sequence: session.nextGameRunSequence,
        configSnapshotJson,
        questions: { create: questionData },
      },
      include: { questions: { orderBy: { position: 'asc' } } },
    })
  })

  return serializeGameRun(run, true)
}

export async function recordGameAttempt(user, sessionId, questionId, input) {
  assertPatient(user)
  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    await claimActiveSession(tx, user.id, sessionId)
    const question = await tx.gameRunQuestion.findFirst({
      where: { id: questionId, gameRun: { sessionId } },
      include: { gameRun: true },
    })

    if (!question) {
      throw new TrainingError(404, 'QUESTION_NOT_FOUND', '训练题目不存在')
    }
    if (question.gameRun.status !== ACTIVE_RUN) {
      throw new TrainingError(409, 'GAME_RUN_NOT_ACTIVE', '本轮游戏已经结束')
    }
    if (question.completedAt) {
      throw new TrainingError(409, 'QUESTION_ALREADY_COMPLETED', '该题已经完成')
    }

    const isRevealed = input.action === 'REVEAL'
    if (isRevealed && question.questionType !== 'OBJECT_NAMING') {
      throw new TrainingError(400, 'REVEAL_NOT_SUPPORTED', '当前题型不支持显示答案')
    }

    const isCorrect = !isRevealed && isCorrectAnswer(question, input.answer)
    const created = await tx.gameAttempt.create({
      data: {
        gameRunQuestionId: question.id,
        answerJson: json({ value: input.answer ?? null }),
        outcome: isRevealed ? 'REVEALED' : isCorrect ? 'CORRECT' : 'WRONG',
        responseTimeMs: input.responseTimeMs,
      },
    })

    if (isCorrect || isRevealed) {
      await tx.gameRunQuestion.update({
        where: { id: question.id },
        data: { completedAt: now },
      })
      const remaining = await tx.gameRunQuestion.count({
        where: { gameRunId: question.gameRunId, completedAt: null },
      })
      if (remaining === 0) {
        await tx.gameRun.update({
          where: { id: question.gameRunId },
          data: { status: 'COMPLETED', endedAt: now },
        })
      }
    }

    if (!isCorrect && !isRevealed) {
      const wrongAttempts = await tx.gameAttempt.count({
        where: { gameRunQuestionId: question.id, outcome: 'WRONG' },
      })
      if (wrongAttempts === 2) {
        await tx.interactionEvent.create({
          data: {
            sessionId,
            gameRunId: question.gameRunId,
            clientEventId: `server-multiple-wrong:${question.id}`,
            type: 'MULTIPLE_WRONG',
            occurredAt: now,
            dataJson: json({ questionId: question.id, wrongAttempts }),
          },
        })
      }
    }

    const run = await tx.gameRun.findUniqueOrThrow({
      where: { id: question.gameRunId },
      select: { status: true, endedAt: true },
    })
    return { attempt: created, question, run, isCorrect, isRevealed }
  })

  return {
    id: result.attempt.id,
    questionId,
    outcome: result.attempt.outcome,
    isCorrect: result.isCorrect,
    isRevealed: result.isRevealed,
    responseTimeMs: result.attempt.responseTimeMs,
    gameRun: {
      id: result.question.gameRunId,
      status: result.run.status,
      endedAt: result.run.endedAt,
    },
    feedback: result.isCorrect ? '对啦，我们继续。' : '没关系，再看看。',
  }
}

export async function recordInteractionEvents(user, sessionId, { events }) {
  assertPatient(user)
  return prisma.$transaction(async (tx) => {
    await claimActiveSession(tx, user.id, sessionId)
    const runIds = [...new Set(events.map((event) => event.gameRunId).filter(Boolean))]

    if (runIds.length) {
      const matchedRuns = await tx.gameRun.count({
        where: { id: { in: runIds }, sessionId },
      })
      if (matchedRuns !== runIds.length) {
        throw new TrainingError(400, 'INVALID_GAME_RUN', '事件包含不属于该会话的游戏轮次')
      }
    }

    const existing = await tx.interactionEvent.findMany({
      where: { sessionId, clientEventId: { in: events.map((event) => event.clientEventId) } },
      select: { clientEventId: true },
    })
    const acceptedIds = new Set(existing.map((event) => event.clientEventId))
    const uniqueEvents = events.filter((event) => {
      if (acceptedIds.has(event.clientEventId)) return false
      acceptedIds.add(event.clientEventId)
      return true
    })

    if (uniqueEvents.length) {
      await tx.interactionEvent.createMany({
        data: uniqueEvents.map((event) => ({
          sessionId,
          gameRunId: event.gameRunId,
          clientEventId: event.clientEventId,
          type: event.type,
          occurredAt: event.occurredAt ?? new Date(),
          dataJson: json(event.data),
        })),
      })
    }

    return { accepted: uniqueEvents.length, duplicate: events.length - uniqueEvents.length }
  })
}

export async function recordConversationTurn(user, sessionId, input) {
  assertPatient(user)
  const turn = await prisma.$transaction(async (tx) => {
    await claimActiveSession(tx, user.id, sessionId)
    const updated = await tx.trainingSession.update({
      where: { id: sessionId },
      data: { nextConversationSequence: { increment: 1 } },
      select: { nextConversationSequence: true },
    })

    return tx.conversationTurn.create({
      data: {
        sessionId,
        sequence: updated.nextConversationSequence - 1,
        role: input.role,
        context: input.context,
        content: input.content,
        inputMethod: input.inputMethod,
        responseLatencyMs: input.responseLatencyMs,
        isUserInitiated: input.isUserInitiated ?? false,
        metadataJson: json(input.metadata),
      },
    })
  })

  return serializeConversationTurn(turn)
}

export async function finalizeTrainingSession(user, sessionId) {
  assertPatient(user)
  const existing = await getOwnedSession(user.id, sessionId, {
    summary: true,
    conversationMemory: true,
  })
  if (!existing) {
    throw new TrainingError(404, 'SESSION_NOT_FOUND', '训练会话不存在')
  }
  const shouldGenerateSummary =
    existing.status === ACTIVE_SESSION || existing.summary?.status !== 'READY'
  const shouldGenerateMemory =
    existing.status === ACTIVE_SESSION || existing.conversationMemory?.status !== 'READY'
  const canRetryGeneration =
    existing.status === 'COMPLETED' && (shouldGenerateSummary || shouldGenerateMemory)
  if (existing.status === 'COMPLETED' && !canRetryGeneration) {
    return getTrainingSession(user, sessionId)
  }
  if (existing.status !== ACTIVE_SESSION && !canRetryGeneration) {
    throw new TrainingError(409, 'SESSION_FINALIZATION_IN_PROGRESS', '训练会话正在结束')
  }

  let finalizationPersisted = false
  try {
    const endedAt = existing.endedAt ?? new Date()
    const claimed = await prisma.$transaction(async (tx) => {
      const update = await tx.trainingSession.updateMany({
        where: { id: sessionId, userId: user.id, status: existing.status },
        data: { status: 'FINALIZING', endedAt },
      })
      if (!update.count) return false

      await tx.gameRun.updateMany({
        where: { sessionId, status: ACTIVE_RUN },
        data: { status: 'ABANDONED', endedAt },
      })
      if (shouldGenerateSummary) {
        await tx.sessionSummary.upsert({
          where: { sessionId },
          update: { status: 'PENDING', errorMessage: null },
          create: { sessionId, status: 'PENDING' },
        })
      }
      if (shouldGenerateMemory) {
        await tx.sessionConversationMemory.upsert({
          where: { sessionId },
          update: { status: 'PENDING', errorMessage: null },
          create: { sessionId, status: 'PENDING' },
        })
      }
      return true
    })

    if (!claimed) {
      const latest = await getOwnedSession(user.id, sessionId, {
        summary: true,
        conversationMemory: true,
      })
      if (
        latest?.status === 'COMPLETED' &&
        latest.summary?.status !== 'FAILED' &&
        latest.conversationMemory?.status !== 'FAILED'
      ) {
        return getTrainingSession(user, sessionId)
      }
      throw new TrainingError(409, 'SESSION_FINALIZATION_IN_PROGRESS', '训练会话正在结束')
    }

    const finalizingSession = await loadSessionDetail(user.id, sessionId)
    const summaryInput = buildSummaryInput(finalizingSession)
    const memoryInput = createSessionConversationMemoryInput({
      conversationTurns: finalizingSession.conversationTurns,
    })
    const metrics = {
      games: summaryInput.games,
      conversation: summaryInput.conversationMetrics,
    }

    await prisma.$transaction(async (tx) => {
      await tx.trainingSession.update({
        where: { id: sessionId },
        data: { metricsJson: json(metrics) },
      })
      if (shouldGenerateSummary) {
        await tx.sessionSummary.update({
          where: { sessionId },
          data: { inputJson: json(summaryInput) },
        })
      }
      if (shouldGenerateMemory) {
        await tx.sessionConversationMemory.update({
          where: { sessionId },
          data: { inputJson: json(memoryInput) },
        })
      }
    })

    const [summaryResult, memoryResult] = await Promise.allSettled([
      shouldGenerateSummary ? generateDoctorSummary(summaryInput) : null,
      shouldGenerateMemory ? generateSessionConversationMemory(memoryInput) : null,
    ])

    const generatedSummary =
      shouldGenerateSummary && summaryResult.status === 'fulfilled' ? summaryResult.value : null
    const generatedMemory =
      shouldGenerateMemory && memoryResult.status === 'fulfilled' ? memoryResult.value : null
    const summaryError =
      shouldGenerateSummary && summaryResult.status === 'rejected' ? summaryResult.reason : null

    await prisma.$transaction(async (tx) => {
      if (shouldGenerateSummary) {
        await tx.sessionSummary.update({
          where: { sessionId },
          data: generatedSummary
            ? {
                status: 'READY',
                provider: generatedSummary.provider,
                promptVersion: generatedSummary.promptVersion,
                resultJson: json(generatedSummary.result),
                generatedAt: new Date(),
                errorMessage: null,
              }
            : {
                status: 'FAILED',
                errorMessage: '医生摘要生成失败，请稍后重试',
              },
        })
      }
      if (shouldGenerateMemory) {
        await tx.sessionConversationMemory.update({
          where: { sessionId },
          data: generatedMemory
            ? {
                status: 'READY',
                provider: generatedMemory.provider,
                model: generatedMemory.model,
                promptVersion: generatedMemory.promptVersion,
                resultJson: json(generatedMemory.result),
                generatedAt: new Date(),
                errorMessage: null,
              }
            : {
                status: 'FAILED',
                errorMessage: '对话记忆生成失败，请稍后重试',
              },
        })
      }
      await tx.trainingSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' },
      })
    })
    finalizationPersisted = true
    if (summaryError) throw summaryError
  } catch (error) {
    if (finalizationPersisted) throw error
    if (error instanceof TrainingError && error.code === 'SESSION_FINALIZATION_IN_PROGRESS') {
      throw error
    }
    await prisma.$transaction(async (tx) => {
      await tx.sessionSummary.upsert({
        where: { sessionId },
        update: {
          status: 'FAILED',
          errorMessage: '医生摘要生成失败，请稍后重试',
        },
        create: {
          sessionId,
          status: 'FAILED',
          errorMessage: '医生摘要生成失败，请稍后重试',
        },
      })
      await tx.sessionConversationMemory.upsert({
        where: { sessionId },
        update: {
          status: 'FAILED',
          errorMessage: '对话记忆生成失败，请稍后重试',
        },
        create: {
          sessionId,
          status: 'FAILED',
          errorMessage: '对话记忆生成失败，请稍后重试',
        },
      })
      await tx.trainingSession.updateMany({
        where: { id: sessionId, userId: user.id, status: 'FINALIZING' },
        data: { status: 'COMPLETED' },
      })
    })
    throw error
  }

  return getTrainingSession(user, sessionId)
}

export async function getTrainingTrends(user) {
  assertPatient(user)
  const sessions = await prisma.trainingSession.findMany({
    where: { userId: user.id, status: 'COMPLETED', metricsJson: { not: null } },
    orderBy: { endedAt: 'desc' },
    take: 10,
    select: { id: true, endedAt: true, metricsJson: true },
  })
  const ordered = [...sessions].reverse()
  const games = {}

  for (const session of ordered) {
    for (const metric of parseJson(session.metricsJson, {}).games ?? []) {
      games[metric.gameCode] ??= []
      games[metric.gameCode].push({
        sessionId: session.id,
        endedAt: session.endedAt,
        accuracy: metric.accuracy,
        averageResponseTimeMs: metric.averageResponseTimeMs,
      })
    }
  }

  return { sessions: ordered.map(({ id, endedAt }) => ({ id, endedAt })), games }
}

export async function createCareAssignment(user, { clinicianId, patientId }) {
  assertRole(user, 'ADMIN', '仅管理员可以管理医患关联')
  if (clinicianId === patientId) {
    throw new TrainingError(400, 'INVALID_CARE_ASSIGNMENT', '医生和患者不能是同一用户')
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [clinicianId, patientId] } },
    select: { id: true, role: true, status: true },
  })
  const clinician = users.find((candidate) => candidate.id === clinicianId)
  const patient = users.find((candidate) => candidate.id === patientId)
  if (
    clinician?.role !== 'DOCTOR' ||
    clinician.status !== 'ACTIVE' ||
    patient?.role !== 'PATIENT' ||
    patient.status !== 'ACTIVE'
  ) {
    throw new TrainingError(400, 'INVALID_CARE_ASSIGNMENT', '关联必须包含一名医生和一名患者')
  }

  const assignment = await prisma.careAssignment.upsert({
    where: { clinicianId_patientId: { clinicianId, patientId } },
    update: { status: 'ACTIVE' },
    create: { clinicianId, patientId, status: 'ACTIVE' },
  })

  return {
    id: assignment.id,
    clinicianId: assignment.clinicianId,
    patientId: assignment.patientId,
    status: assignment.status,
  }
}

async function assertDoctorCanReadPatient(doctor, patientId) {
  assertRole(doctor, 'DOCTOR', '仅医生可以查看患者训练摘要')
  if (!Number.isInteger(patientId) || patientId <= 0) {
    throw new TrainingError(400, 'INVALID_PATIENT_ID', '患者 ID 无效')
  }
  const assignment = await prisma.careAssignment.findUnique({
    where: { clinicianId_patientId: { clinicianId: doctor.id, patientId } },
  })
  if (!assignment || assignment.status !== 'ACTIVE') {
    throw new TrainingError(403, 'PATIENT_ACCESS_DENIED', '没有该患者的训练记录访问权限')
  }
}

function serializeDoctorSession(session) {
  return {
    id: session.id,
    patientId: session.userId,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    metrics: parseJson(session.metricsJson, null),
    summary: serializeSummary(session.summary),
  }
}

export async function listDoctorPatientSessions(doctor, patientId) {
  await assertDoctorCanReadPatient(doctor, patientId)
  const sessions = await prisma.trainingSession.findMany({
    where: { userId: patientId },
    orderBy: { startedAt: 'desc' },
    take: 30,
    include: { summary: true },
  })

  return sessions.map(serializeDoctorSession)
}

export async function getDoctorSession(doctor, sessionId) {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { summary: true },
  })
  if (!session) {
    throw new TrainingError(404, 'SESSION_NOT_FOUND', '训练会话不存在')
  }
  await assertDoctorCanReadPatient(doctor, session.userId)
  return serializeDoctorSession(session)
}
