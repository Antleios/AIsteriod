import { Router } from 'express'
import { loadAuthentication, requireAuthentication } from '../middleware/auth.js'
import { createOriginGuard } from '../middleware/originGuard.js'
import {
  createCareAssignmentSchema,
  createGameRunSchema,
  createTrainingSessionSchema,
  recordAttemptSchema,
  recordConversationSchema,
  recordEventsSchema,
  serializeValidationIssues,
} from '../validation/trainingSchemas.js'
import {
  createCareAssignment,
  createGameRun,
  createTrainingSession,
  finalizeTrainingSession,
  getDoctorSession,
  getTrainingSession,
  getTrainingTrends,
  listDoctorPatientSessions,
  listTrainingSessions,
  recordConversationTurn,
  recordGameAttempt,
  recordInteractionEvents,
} from '../services/trainingService.js'

function parseBody(schema, res, body) {
  const parsed = schema.safeParse(body)
  if (parsed.success) return parsed.data

  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: '请求参数无效',
      details: serializeValidationIssues(parsed.error),
    },
  })
  return null
}

export function createTrainingRouter({ allowedOrigins }) {
  const router = Router()
  const originGuard = createOriginGuard(allowedOrigins)

  router.use(loadAuthentication, requireAuthentication)
  router.use((req, res, next) => {
    void req
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.post('/sessions', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(createTrainingSessionSchema, res, req.body)
      if (!input) return
      const session = await createTrainingSession(req.auth.user, input)
      res.status(201).json({ session })
    } catch (error) {
      next(error)
    }
  })

  router.get('/sessions', async (req, res, next) => {
    try {
      res.json({ sessions: await listTrainingSessions(req.auth.user) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/trends', async (req, res, next) => {
    try {
      res.json({ trends: await getTrainingTrends(req.auth.user) })
    } catch (error) {
      next(error)
    }
  })

  router.post('/care-assignments', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(createCareAssignmentSchema, res, req.body)
      if (!input) return
      const assignment = await createCareAssignment(req.auth.user, input)
      res.status(201).json({ assignment })
    } catch (error) {
      next(error)
    }
  })

  router.get('/doctor/patients/:patientId/sessions', async (req, res, next) => {
    try {
      const sessions = await listDoctorPatientSessions(
        req.auth.user,
        Number(req.params.patientId),
      )
      res.json({ sessions })
    } catch (error) {
      next(error)
    }
  })

  router.get('/doctor/sessions/:sessionId', async (req, res, next) => {
    try {
      res.json({ session: await getDoctorSession(req.auth.user, req.params.sessionId) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/sessions/:sessionId', async (req, res, next) => {
    try {
      res.json({ session: await getTrainingSession(req.auth.user, req.params.sessionId) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/sessions/:sessionId/summary', async (req, res, next) => {
    try {
      const session = await getTrainingSession(req.auth.user, req.params.sessionId)
      res.json({ summary: session.summary, status: session.status })
    } catch (error) {
      next(error)
    }
  })

  router.post('/sessions/:sessionId/game-runs', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(createGameRunSchema, res, req.body)
      if (!input) return
      const gameRun = await createGameRun(req.auth.user, req.params.sessionId, input)
      res.status(201).json({ gameRun })
    } catch (error) {
      next(error)
    }
  })

  router.post('/sessions/:sessionId/questions/:questionId/attempts', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(recordAttemptSchema, res, req.body)
      if (!input) return
      const attempt = await recordGameAttempt(
        req.auth.user,
        req.params.sessionId,
        req.params.questionId,
        input,
      )
      res.status(201).json({ attempt })
    } catch (error) {
      next(error)
    }
  })

  router.post('/sessions/:sessionId/events', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(recordEventsSchema, res, req.body)
      if (!input) return
      res.status(201).json({
        result: await recordInteractionEvents(req.auth.user, req.params.sessionId, input),
      })
    } catch (error) {
      next(error)
    }
  })

  router.post('/sessions/:sessionId/conversation-turns', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(recordConversationSchema, res, req.body)
      if (!input) return
      const turn = await recordConversationTurn(req.auth.user, req.params.sessionId, input)
      res.status(201).json({ turn })
    } catch (error) {
      next(error)
    }
  })

  router.post('/sessions/:sessionId/finalize', originGuard, async (req, res, next) => {
    try {
      res.json({ session: await finalizeTrainingSession(req.auth.user, req.params.sessionId) })
    } catch (error) {
      next(error)
    }
  })

  return router
}
