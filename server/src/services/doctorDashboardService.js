import prisma from '../db/prisma.js'

const GAME_DEFINITIONS = {
  'object-naming': '物品命名游戏',
  'emoji-match': '表情匹配游戏',
  'color-line': '颜色连线游戏',
}

const CONVERSATION_CONTEXT_TITLES = {
  CHAT: '日常交流',
  OBJECT_NAMING: '物品命名',
  EMOJI_MATCH: '表情匹配',
  COLOR_LINE: '颜色连线',
}

const RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const RECENT_ACTIVITY_DAYS = 7

export class DoctorDashboardError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function assertDoctor(user) {
  if (user.role !== 'DOCTOR') {
    throw new DoctorDashboardError(403, 'DOCTOR_ROLE_REQUIRED', '仅医生可以查看数据看板')
  }
}

function round(value, digits = 1) {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function parseJson(value, fallback = null) {
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function durationMs(startedAt, endedAt, now = new Date()) {
  return Math.max(0, (endedAt ?? now).getTime() - startedAt.getTime())
}

function toUtcDate(value) {
  return value.toISOString().slice(0, 10)
}

function startOfUtcDay(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function getDateRange(range) {
  const endAt = new Date()
  const startAt = startOfUtcDay(endAt)
  startAt.setUTCDate(startAt.getUTCDate() - RANGE_DAYS[range] + 1)

  return { startAt, endAt }
}

function patientScope(doctorId) {
  return {
    patientAssignments: {
      some: { clinicianId: doctorId, status: 'ACTIVE' },
    },
  }
}

function assertPatientId(patientId) {
  if (!Number.isInteger(patientId) || patientId <= 0) {
    throw new DoctorDashboardError(400, 'INVALID_PATIENT_ID', '患者 ID 无效')
  }
}

async function getAssignedPatient(doctorId, patientId) {
  assertPatientId(patientId)
  const patient = await prisma.user.findFirst({
    where: { id: patientId, ...patientScope(doctorId) },
    select: {
      id: true,
      username: true,
      displayName: true,
      createdAt: true,
      patientProfile: true,
    },
  })

  if (!patient) {
    throw new DoctorDashboardError(403, 'PATIENT_ACCESS_DENIED', '没有该患者的数据访问权限')
  }

  return patient
}

function serializePatientProfile(profile) {
  return {
    age: profile?.age ?? null,
    gender: profile?.gender ?? null,
    diagnosis: profile?.diagnosis ?? null,
    caseNotes: profile?.caseNotes ?? null,
    updatedAt: profile?.updatedAt ?? null,
  }
}

function serializeAssignedPatient(patient) {
  return {
    id: patient.id,
    username: patient.username,
    displayName: patient.displayName,
    createdAt: patient.createdAt,
    profile: serializePatientProfile(patient.patientProfile),
  }
}

function gameRunInclude() {
  return {
    session: {
      select: {
        id: true,
        userId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        user: { select: { id: true, displayName: true } },
      },
    },
    questions: {
      select: {
        id: true,
        attempts: {
          select: { outcome: true, responseTimeMs: true },
        },
      },
    },
  }
}

function getGameMetrics(run, now) {
  const attempts = run.questions.flatMap((question) => question.attempts)
  const correctCount = attempts.filter((attempt) => attempt.outcome === 'CORRECT').length
  const wrongCount = attempts.filter((attempt) => attempt.outcome === 'WRONG').length
  const revealedCount = attempts.filter((attempt) => attempt.outcome === 'REVEALED').length
  const responseTimes = attempts
    .map((attempt) => attempt.responseTimeMs)
    .filter((value) => Number.isInteger(value))
  const assessedCount = correctCount + wrongCount

  return {
    questionCount: run.questions.length,
    totalAttempts: attempts.length,
    correctCount,
    wrongCount,
    revealedCount,
    assessedCount,
    accuracy: assessedCount ? round((correctCount / assessedCount) * 100) : null,
    averageResponseTimeMs: responseTimes.length
      ? round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
      : null,
    durationMs: durationMs(run.startedAt, run.endedAt, now),
  }
}

function serializeTrainingRecord(run, now) {
  const metrics = getGameMetrics(run, now)

  return {
    id: run.id,
    sessionId: run.session.id,
    patient: {
      id: run.session.user.id,
      displayName: run.session.user.displayName,
    },
    gameCode: run.gameCode,
    gameTitle: GAME_DEFINITIONS[run.gameCode] ?? run.gameCode,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    ...metrics,
    score: metrics.accuracy,
  }
}

function serializeLastTraining(run, now) {
  if (!run) return null

  return {
    id: run.id,
    gameCode: run.gameCode,
    gameTitle: GAME_DEFINITIONS[run.gameCode] ?? run.gameCode,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    ...getGameMetrics(run, now),
  }
}

function getTrainingStatus(lastTraining, now) {
  if (!lastTraining) {
    return { code: 'NO_TRAINING_RECORD', lastTrainingAt: null }
  }
  if (lastTraining.status === 'ACTIVE') {
    return { code: 'TRAINING_IN_PROGRESS', lastTrainingAt: lastTraining.startedAt }
  }

  const recentThreshold = now.getTime() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1_000
  return {
    code: lastTraining.startedAt.getTime() >= recentThreshold ? 'RECENTLY_ACTIVE' : 'INACTIVE',
    lastTrainingAt: lastTraining.startedAt,
  }
}

function addGameMetric(target, run, now) {
  const metrics = getGameMetrics(run, now)
  const game = target.get(run.gameCode) ?? {
    gameCode: run.gameCode,
    gameTitle: GAME_DEFINITIONS[run.gameCode] ?? run.gameCode,
    gameRunCount: 0,
    completedRunCount: 0,
    questionCount: 0,
    totalAttempts: 0,
    correctCount: 0,
    wrongCount: 0,
    revealedCount: 0,
    responseTimeTotalMs: 0,
    responseTimeCount: 0,
    durationMs: 0,
  }
  const responseTimes = run.questions
    .flatMap((question) => question.attempts)
    .map((attempt) => attempt.responseTimeMs)
    .filter((value) => Number.isInteger(value))

  game.gameRunCount += 1
  game.completedRunCount += run.status === 'COMPLETED' ? 1 : 0
  game.questionCount += metrics.questionCount
  game.totalAttempts += metrics.totalAttempts
  game.correctCount += metrics.correctCount
  game.wrongCount += metrics.wrongCount
  game.revealedCount += metrics.revealedCount
  game.responseTimeTotalMs += responseTimes.reduce((sum, value) => sum + value, 0)
  game.responseTimeCount += responseTimes.length
  game.durationMs += metrics.durationMs
  target.set(run.gameCode, game)
}

function serializeGamePerformance(game) {
  const assessedCount = game.correctCount + game.wrongCount

  return {
    gameCode: game.gameCode,
    gameTitle: game.gameTitle,
    gameRunCount: game.gameRunCount,
    completedRunCount: game.completedRunCount,
    questionCount: game.questionCount,
    totalAttempts: game.totalAttempts,
    correctCount: game.correctCount,
    wrongCount: game.wrongCount,
    revealedCount: game.revealedCount,
    accuracy: assessedCount ? round((game.correctCount / assessedCount) * 100) : null,
    averageResponseTimeMs: game.responseTimeCount
      ? round(game.responseTimeTotalMs / game.responseTimeCount)
      : null,
    durationMs: game.durationMs,
  }
}

function createDailyTraining(startAt, range) {
  const days = new Map()

  for (let offset = 0; offset < RANGE_DAYS[range]; offset += 1) {
    const date = new Date(startAt)
    date.setUTCDate(date.getUTCDate() + offset)
    const key = toUtcDate(date)
    days.set(key, {
      date: key,
      gameRunCount: 0,
      completedRunCount: 0,
      durationMs: 0,
    })
  }

  return days
}

function addDailyMetric(days, run, now) {
  const daily = days.get(toUtcDate(run.startedAt))
  if (!daily) return

  daily.gameRunCount += 1
  daily.completedRunCount += run.status === 'COMPLETED' ? 1 : 0
  daily.durationMs += durationMs(run.startedAt, run.endedAt, now)
}

function getMatchingGameCodes(query) {
  const normalized = query.toLocaleLowerCase('zh-CN')
  return Object.entries(GAME_DEFINITIONS)
    .filter(([gameCode, title]) =>
      `${gameCode} ${title}`.toLocaleLowerCase('zh-CN').includes(normalized),
    )
    .map(([gameCode]) => gameCode)
}

async function getLatestTrainingByPatient(patientIds) {
  if (!patientIds.length) return new Map()

  const gameRuns = await prisma.gameRun.findMany({
    where: { session: { userId: { in: patientIds } } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    include: gameRunInclude(),
  })

  const latestTrainingByPatient = new Map()
  for (const run of gameRuns) {
    if (!latestTrainingByPatient.has(run.session.userId)) {
      latestTrainingByPatient.set(run.session.userId, run)
    }
  }

  return latestTrainingByPatient
}

function safeSummary(resultJson) {
  const result = parseJson(resultJson, {})
  const text = (key) => (typeof result?.[key] === 'string' ? result[key] : null)

  return {
    sessionOverview: text('sessionOverview'),
    interactionSummary: text('interactionSummary'),
    comparisonWithinSession: text('comparisonWithinSession'),
  }
}

function serializeSessionSummary(session, now) {
  const summary = session.summary
  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: durationMs(session.startedAt, session.endedAt, now),
    summaryStatus: summary?.status ?? 'NOT_GENERATED',
    summaryGeneratedAt: summary?.generatedAt ?? null,
    summary: summary?.resultJson ? safeSummary(summary.resultJson) : null,
  }
}

function serializeConversationSummary(session, now) {
  const contextCodes = [...new Set(session.conversationTurns.map((turn) => turn.context))]
  const summary = session.summary
  const lastTurn = session.conversationTurns.reduce(
    (latest, turn) => (!latest || turn.sequence > latest.sequence ? turn : latest),
    null,
  )

  return {
    id: session.id,
    patient: {
      id: session.user.id,
      displayName: session.user.displayName,
    },
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: durationMs(session.startedAt, session.endedAt, now),
    lastMessageAt: lastTurn?.createdAt ?? null,
    turnCount: session._count.conversationTurns,
    contexts: contextCodes.map((code) => ({
      code,
      title: CONVERSATION_CONTEXT_TITLES[code] ?? code,
    })),
    summaryStatus: summary?.status ?? 'NOT_GENERATED',
    summaryGeneratedAt: summary?.generatedAt ?? null,
    summary: summary?.resultJson ? safeSummary(summary.resultJson) : null,
  }
}

function serializeDoctorConversationTurn(turn, interactionsByTurnId) {
  const interaction = interactionsByTurnId.get(turn.id) ?? null
  const metadata = parseJson(turn.metadataJson, {})

  return {
    id: turn.id,
    sequence: turn.sequence,
    role: turn.role,
    context: turn.context,
    contextTitle: CONVERSATION_CONTEXT_TITLES[turn.context] ?? turn.context,
    content: turn.content,
    inputMethod: turn.inputMethod,
    responseLatencyMs: turn.responseLatencyMs,
    isUserInitiated: turn.isUserInitiated,
    emotion: typeof metadata.emotion === 'string' ? metadata.emotion : null,
    createdAt: turn.createdAt,
    ai: interaction
      ? {
          interactionId: interaction.id,
          status: interaction.status,
          trigger: interaction.trigger,
          provider: interaction.provider,
          model: interaction.model,
          promptVersion: interaction.promptVersion,
        }
      : null,
  }
}

function serializeDoctorConversation(session, now) {
  const interactionsByTurnId = new Map()
  for (const interaction of session.aiInteractions) {
    if (interaction.userTurnId) interactionsByTurnId.set(interaction.userTurnId, interaction)
    if (interaction.assistantTurnId) {
      interactionsByTurnId.set(interaction.assistantTurnId, interaction)
    }
  }

  return {
    ...serializeConversationSummary(session, now),
    turns: session.conversationTurns.map((turn) =>
      serializeDoctorConversationTurn(turn, interactionsByTurnId),
    ),
  }
}

export async function getDoctorDashboard(doctor, { range }) {
  assertDoctor(doctor)
  const { startAt, endAt } = getDateRange(range)
  const scopedPatient = patientScope(doctor.id)
  const activityScope = {
    session: { user: scopedPatient },
    startedAt: { gte: startAt, lte: endAt },
  }
  const sessionScope = {
    user: scopedPatient,
    startedAt: { gte: startAt, lte: endAt },
  }

  const [assignedPatientCount, sessions, gameRuns] = await Promise.all([
    prisma.careAssignment.count({
      where: { clinicianId: doctor.id, status: 'ACTIVE' },
    }),
    prisma.trainingSession.findMany({
      where: sessionScope,
      select: { userId: true, status: true },
    }),
    prisma.gameRun.findMany({
      where: activityScope,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      include: gameRunInclude(),
    }),
  ])

  const gamePerformance = new Map()
  const dailyTraining = createDailyTraining(startAt, range)
  const activePatientIds = new Set()
  let correctCount = 0
  let wrongCount = 0
  let responseTimeTotalMs = 0
  let responseTimeCount = 0
  let totalTrainingDurationMs = 0

  for (const run of gameRuns) {
    const metrics = getGameMetrics(run, endAt)
    activePatientIds.add(run.session.userId)
    correctCount += metrics.correctCount
    wrongCount += metrics.wrongCount
    totalTrainingDurationMs += metrics.durationMs
    for (const question of run.questions) {
      for (const attempt of question.attempts) {
        if (Number.isInteger(attempt.responseTimeMs)) {
          responseTimeTotalMs += attempt.responseTimeMs
          responseTimeCount += 1
        }
      }
    }
    addGameMetric(gamePerformance, run, endAt)
    addDailyMetric(dailyTraining, run, endAt)
  }

  const completedSessionCount = sessions.filter((session) => session.status === 'COMPLETED').length
  const assessedCount = correctCount + wrongCount

  return {
    range: { key: range, startAt, endAt, timezone: 'UTC' },
    stats: {
      assignedPatientCount,
      activePatientCount: activePatientIds.size,
      sessionCount: sessions.length,
      completedSessionCount,
      sessionCompletionRate: sessions.length
        ? round((completedSessionCount / sessions.length) * 100)
        : null,
      gameRunCount: gameRuns.length,
      averageAccuracy: assessedCount ? round((correctCount / assessedCount) * 100) : null,
      averageResponseTimeMs: responseTimeCount
        ? round(responseTimeTotalMs / responseTimeCount)
        : null,
      totalTrainingDurationMs,
    },
    dailyTraining: [...dailyTraining.values()],
    gamePerformance: [...gamePerformance.values()]
      .map(serializeGamePerformance)
      .sort((left, right) => right.gameRunCount - left.gameRunCount || left.gameCode.localeCompare(right.gameCode)),
    recentRecords: gameRuns.slice(0, 6).map((run) => serializeTrainingRecord(run, endAt)),
  }
}

export async function listDoctorTrainingRecords(doctor, input) {
  assertDoctor(doctor)
  const now = new Date()
  const filters = {
    session: { user: patientScope(doctor.id) },
  }

  if (input.gameCode) filters.gameCode = input.gameCode
  if (input.q) {
    const matchingGameCodes = getMatchingGameCodes(input.q)
    filters.OR = [
      { session: { user: { ...patientScope(doctor.id), displayName: { contains: input.q } } } },
      ...(matchingGameCodes.length ? [{ gameCode: { in: matchingGameCodes } }] : []),
    ]
  }

  if (input.cursor) {
    const cursor = await prisma.gameRun.findFirst({
      where: { ...filters, id: input.cursor },
      select: { id: true },
    })
    if (!cursor) {
      throw new DoctorDashboardError(400, 'INVALID_TRAINING_RECORD_CURSOR', '训练记录分页游标无效')
    }
  }

  const gameRuns = await prisma.gameRun.findMany({
    where: filters,
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
    include: gameRunInclude(),
  })
  const hasMore = gameRuns.length > input.limit
  const page = hasMore ? gameRuns.slice(0, input.limit) : gameRuns

  return {
    records: page.map((run) => serializeTrainingRecord(run, now)),
    page: {
      limit: input.limit,
      nextCursor: hasMore ? page.at(-1).id : null,
    },
  }
}

export async function listDoctorPatients(doctor, input) {
  assertDoctor(doctor)
  const filters = { clinicianId: doctor.id, status: 'ACTIVE' }
  if (input.q) {
    filters.patient = {
      OR: [
        { displayName: { contains: input.q } },
        { username: { contains: input.q } },
      ],
    }
  }

  if (input.cursor) {
    const cursor = await prisma.careAssignment.findFirst({
      where: { ...filters, id: input.cursor },
      select: { id: true },
    })
    if (!cursor) {
      throw new DoctorDashboardError(400, 'INVALID_PATIENT_CURSOR', '患者列表分页游标无效')
    }
  }

  const [total, assignments] = await Promise.all([
    prisma.careAssignment.count({ where: filters }),
    prisma.careAssignment.findMany({
      where: filters,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      select: {
        id: true,
        status: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            username: true,
            displayName: true,
            createdAt: true,
            patientProfile: true,
          },
        },
      },
    }),
  ])
  const hasMore = assignments.length > input.limit
  const page = hasMore ? assignments.slice(0, input.limit) : assignments
  const latestTrainingByPatient = await getLatestTrainingByPatient(
    page.map((assignment) => assignment.patient.id),
  )
  const now = new Date()

  return {
    patients: page.map((assignment) => {
      const lastTraining = latestTrainingByPatient.get(assignment.patient.id) ?? null
      return {
        ...serializeAssignedPatient(assignment.patient),
        assignment: {
          id: assignment.id,
          status: assignment.status,
          assignedAt: assignment.createdAt,
        },
        trainingStatus: getTrainingStatus(lastTraining, now),
        lastTraining: serializeLastTraining(lastTraining, now),
      }
    }),
    page: {
      limit: input.limit,
      total,
      nextCursor: hasMore ? page.at(-1).id : null,
    },
  }
}

export async function assignPatientToDoctor(doctor, { username }) {
  assertDoctor(doctor)
  const patient = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
      patientProfile: true,
    },
  })

  if (!patient || patient.role !== 'PATIENT' || patient.status !== 'ACTIVE') {
    throw new DoctorDashboardError(
      404,
      'PATIENT_ACCOUNT_NOT_FOUND',
      '没有找到可关联的患者账号',
    )
  }

  const existing = await prisma.careAssignment.findUnique({
    where: {
      clinicianId_patientId: { clinicianId: doctor.id, patientId: patient.id },
    },
  })
  if (existing?.status === 'ACTIVE') {
    throw new DoctorDashboardError(409, 'PATIENT_ALREADY_ASSIGNED', '该患者已经关联当前医生')
  }

  const assignment = await prisma.careAssignment.upsert({
    where: {
      clinicianId_patientId: { clinicianId: doctor.id, patientId: patient.id },
    },
    update: { status: 'ACTIVE' },
    create: { clinicianId: doctor.id, patientId: patient.id, status: 'ACTIVE' },
  })

  return {
    id: assignment.id,
    status: assignment.status,
    assignedAt: assignment.createdAt,
    patient: serializeAssignedPatient(patient),
  }
}

export async function updateDoctorPatientProfile(doctor, patientId, input) {
  assertDoctor(doctor)
  await getAssignedPatient(doctor.id, patientId)
  const profile = await prisma.patientProfile.upsert({
    where: { userId: patientId },
    update: input,
    create: { userId: patientId, ...input },
  })

  return serializePatientProfile(profile)
}

export async function getDoctorPatientOverview(doctor, patientId, { range }) {
  assertDoctor(doctor)
  const patient = await getAssignedPatient(doctor.id, patientId)
  const { startAt, endAt } = getDateRange(range)
  const activityScope = {
    session: { userId: patient.id },
    startedAt: { gte: startAt, lte: endAt },
  }
  const sessionScope = {
    userId: patient.id,
    startedAt: { gte: startAt, lte: endAt },
  }

  const [sessionStats, recentSessions, gameRuns] = await Promise.all([
    prisma.trainingSession.findMany({
      where: sessionScope,
      select: { status: true },
    }),
    prisma.trainingSession.findMany({
      where: sessionScope,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 6,
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        summary: {
          select: { status: true, generatedAt: true, resultJson: true },
        },
      },
    }),
    prisma.gameRun.findMany({
      where: activityScope,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      include: gameRunInclude(),
    }),
  ])

  const gamePerformance = new Map()
  const dailyTraining = createDailyTraining(startAt, range)
  let correctCount = 0
  let wrongCount = 0
  let responseTimeTotalMs = 0
  let responseTimeCount = 0
  let totalTrainingDurationMs = 0

  for (const run of gameRuns) {
    const metrics = getGameMetrics(run, endAt)
    correctCount += metrics.correctCount
    wrongCount += metrics.wrongCount
    totalTrainingDurationMs += metrics.durationMs
    for (const question of run.questions) {
      for (const attempt of question.attempts) {
        if (Number.isInteger(attempt.responseTimeMs)) {
          responseTimeTotalMs += attempt.responseTimeMs
          responseTimeCount += 1
        }
      }
    }
    addGameMetric(gamePerformance, run, endAt)
    addDailyMetric(dailyTraining, run, endAt)
  }

  const assessedCount = correctCount + wrongCount
  const completedSessionCount = sessionStats.filter(
    (session) => session.status === 'COMPLETED',
  ).length

  return {
    patient: serializeAssignedPatient(patient),
    range: { key: range, startAt, endAt, timezone: 'UTC' },
    stats: {
      sessionCount: sessionStats.length,
      completedSessionCount,
      sessionCompletionRate: sessionStats.length
        ? round((completedSessionCount / sessionStats.length) * 100)
        : null,
      gameRunCount: gameRuns.length,
      averageAccuracy: assessedCount ? round((correctCount / assessedCount) * 100) : null,
      averageResponseTimeMs: responseTimeCount
        ? round(responseTimeTotalMs / responseTimeCount)
        : null,
      totalTrainingDurationMs,
    },
    dailyTraining: [...dailyTraining.values()],
    gamePerformance: [...gamePerformance.values()]
      .map(serializeGamePerformance)
      .sort((left, right) => right.gameRunCount - left.gameRunCount || left.gameCode.localeCompare(right.gameCode)),
    recentRecords: gameRuns.slice(0, 6).map((run) => serializeTrainingRecord(run, endAt)),
    recentSessionSummaries: recentSessions.map((session) => serializeSessionSummary(session, endAt)),
  }
}

export async function listDoctorConversationSummaries(doctor, input) {
  assertDoctor(doctor)
  const now = new Date()
  const filters = {
    user: patientScope(doctor.id),
    conversationTurns: { some: {} },
  }
  if (input.q) {
    filters.OR = [
      { user: { ...patientScope(doctor.id), displayName: { contains: input.q } } },
      { conversationTurns: { some: { content: { contains: input.q } } } },
    ]
  }

  if (input.cursor) {
    const cursor = await prisma.trainingSession.findFirst({
      where: { ...filters, id: input.cursor },
      select: { id: true },
    })
    if (!cursor) {
      throw new DoctorDashboardError(400, 'INVALID_CONVERSATION_CURSOR', '对话列表分页游标无效')
    }
  }

  const [total, sessions] = await Promise.all([
    prisma.trainingSession.count({ where: filters }),
    prisma.trainingSession.findMany({
      where: filters,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        user: { select: { id: true, displayName: true } },
        conversationTurns: { select: { sequence: true, context: true, createdAt: true } },
        summary: { select: { status: true, generatedAt: true, resultJson: true } },
        _count: { select: { conversationTurns: true } },
      },
    }),
  ])
  const hasMore = sessions.length > input.limit
  const page = hasMore ? sessions.slice(0, input.limit) : sessions

  return {
    conversations: page.map((session) => serializeConversationSummary(session, now)),
    page: {
      limit: input.limit,
      total,
      nextCursor: hasMore ? page.at(-1).id : null,
    },
  }
}

export async function getDoctorConversation(doctor, sessionId) {
  assertDoctor(doctor)
  const session = await prisma.trainingSession.findFirst({
    where: {
      id: sessionId,
      user: patientScope(doctor.id),
      conversationTurns: { some: {} },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      user: { select: { id: true, displayName: true } },
      conversationTurns: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          role: true,
          context: true,
          content: true,
          inputMethod: true,
          responseLatencyMs: true,
          isUserInitiated: true,
          metadataJson: true,
          createdAt: true,
        },
      },
      aiInteractions: {
        select: {
          id: true,
          status: true,
          trigger: true,
          provider: true,
          model: true,
          promptVersion: true,
          userTurnId: true,
          assistantTurnId: true,
        },
      },
      summary: { select: { status: true, generatedAt: true, resultJson: true } },
      _count: { select: { conversationTurns: true } },
    },
  })

  if (!session) {
    throw new DoctorDashboardError(
      403,
      'CONVERSATION_ACCESS_DENIED',
      '没有该对话记录的访问权限',
    )
  }

  return serializeDoctorConversation(session, new Date())
}
