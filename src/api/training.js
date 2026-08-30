import { apiGet, apiPost } from './client.js'
import { fetchCurrentUser } from './auth.js'

const ACTIVE_SESSION_KEY = 'aisteriod.activeTrainingSession.v1'
let pendingSessionPromise = null
const pendingAiRequests = new Map()

function createClientId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${Date.now()}-${random}`.slice(0, 96)
}

function readStoredSession() {
  try {
    const value = localStorage.getItem(ACTIVE_SESSION_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function storeSession(session) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage is only a convenience for restoring an active server session.
  }
}

export function clearActiveTrainingSession() {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
  } catch {
    // Ignore private-browser storage failures.
  }
}

export function getStoredActiveTrainingSession() {
  return readStoredSession()
}

async function getPatient() {
  const user = await fetchCurrentUser()
  return user?.role === 'PATIENT' ? user : null
}

async function getStoredActiveSession(user) {
  const stored = readStoredSession()
  if (!stored?.sessionId || stored.userId !== user.id) return null

  try {
    const { session } = await apiGet(`/api/training/sessions/${stored.sessionId}`)
    if (session.status === 'ACTIVE') return stored
    clearActiveTrainingSession()
    return null
  } catch (error) {
    if ([403, 404].includes(error.status)) {
      clearActiveTrainingSession()
      return null
    }
    throw error
  }
}

async function findActiveTrainingSession(user) {
  const stored = await getStoredActiveSession(user)
  if (stored) return stored

  const { sessions } = await apiGet('/api/training/sessions')
  const active = sessions.find((session) => session.status === 'ACTIVE')
  if (!active) return null

  const restored = { userId: user.id, sessionId: active.id }
  storeSession(restored)
  return restored
}

export async function getActiveTrainingSession() {
  const user = await getPatient()
  if (!user) return null
  return findActiveTrainingSession(user)
}

/** Restore the patient's active visit, or create one only when an activity starts. */
export async function ensureTrainingSession(metadata = {}) {
  if (pendingSessionPromise) return pendingSessionPromise

  pendingSessionPromise = (async () => {
    const user = await getPatient()
    if (!user) return null

    const active = await findActiveTrainingSession(user)
    if (active) return active

    const { session } = await apiPost('/api/training/sessions', {
      metadata: { source: 'web', ...metadata },
    })
    const created = { userId: user.id, sessionId: session.id }
    storeSession(created)
    return created
  })()

  try {
    return await pendingSessionPromise
  } finally {
    pendingSessionPromise = null
  }
}

async function getExistingSession() {
  const user = await getPatient()
  if (!user) return null
  return findActiveTrainingSession(user)
}

export async function startTrainingGame(gameCode) {
  const active = await ensureTrainingSession({ entry: gameCode })
  if (!active) return null

  const { gameRun } = await apiPost(
    `/api/training/sessions/${active.sessionId}/game-runs`,
    { gameCode },
  )
  try {
    await recordTrainingEvents([{ type: 'GAME_START', gameRunId: gameRun.id }])
  } catch {
    // The immutable game run is already saved; telemetry can be retried independently.
  }
  return { sessionId: active.sessionId, gameRun }
}

export async function recordTrainingAttempt({ questionId, answer, action, responseTimeMs }) {
  const active = await getExistingSession()
  if (!active || !questionId) return null
  const { attempt } = await apiPost(
    `/api/training/sessions/${active.sessionId}/questions/${questionId}/attempts`,
    { answer: answer == null ? null : String(answer), action, responseTimeMs },
  )
  try {
    await recordTrainingEvents([
      {
        type: attempt.isRevealed ? 'QUESTION_REVEALED' : attempt.isCorrect ? 'CORRECT' : 'WRONG',
        gameRunId: attempt.gameRun.id,
        data: { questionId, responseTimeMs },
      },
      ...(attempt.gameRun.status === 'COMPLETED'
        ? [{ type: 'GAME_COMPLETE', gameRunId: attempt.gameRun.id }]
        : []),
    ])
  } catch {
    // Attempt scoring is authoritative and must not be rolled back by telemetry failure.
  }
  return attempt
}

export async function recordTrainingEvents(events) {
  const active = await getExistingSession()
  if (!active || !events?.length) return null
  const payload = events.map((event) => ({
    ...event,
    clientEventId: event.clientEventId ?? createClientId(event.type.toLowerCase()),
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  }))
  return apiPost(`/api/training/sessions/${active.sessionId}/events`, { events: payload })
}

export async function requestSessionAiReply({
  clientRequestId,
  userText,
  inputMethod = 'TEXT',
  context = 'CHAT',
  gameRunId,
  trigger = 'USER_MESSAGE',
  gameState,
}) {
  const active = await ensureTrainingSession({ entry: 'ai-chat' })
  if (!active) return null
  const requestId = clientRequestId ?? createClientId('ai')
  const requestKey = `${active.sessionId}:${requestId}`
  if (pendingAiRequests.has(requestKey)) return pendingAiRequests.get(requestKey)

  const pending = apiPost(
    `/api/ai/sessions/${active.sessionId}/interactions`,
    {
      clientRequestId: requestId,
      userText,
      inputMethod,
      context,
      gameRunId,
      trigger,
      gameState,
    },
  ).then(({ interaction }) => interaction)
  pendingAiRequests.set(requestKey, pending)

  try {
    return await pending
  } finally {
    pendingAiRequests.delete(requestKey)
  }
}

export async function finishTrainingSession({ reason = 'USER_QUIT', gameRunId } = {}) {
  const active = await getExistingSession()
  if (!active) return null
  try {
    await recordTrainingEvents([
      { type: 'USER_QUIT', gameRunId, data: { reason } },
    ])
  } catch {
    // Finalization still closes the authoritative session if optional telemetry fails.
  }
  const { session } = await apiPost(
    `/api/training/sessions/${active.sessionId}/finalize`,
    {},
  )
  clearActiveTrainingSession()
  return session
}
