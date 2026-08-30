import { Router } from 'express'
import {
  assignPatientSchema,
  conversationSummariesQuerySchema,
  dashboardQuerySchema,
  patientOverviewQuerySchema,
  patientProfileSchema,
  patientsQuerySchema,
  trainingRecordsQuerySchema,
} from '../validation/doctorDashboardSchemas.js'
import { serializeValidationIssues } from '../validation/trainingSchemas.js'
import {
  assignPatientToDoctor,
  getDoctorDashboard,
  getDoctorConversation,
  getDoctorPatientOverview,
  listDoctorConversationSummaries,
  listDoctorPatients,
  listDoctorTrainingRecords,
  updateDoctorPatientProfile,
} from '../services/doctorDashboardService.js'
import {
  loadAuthentication,
  requireAuthentication,
  requireRole,
} from '../middleware/auth.js'
import { createOriginGuard } from '../middleware/originGuard.js'

function parseQuery(schema, res, query) {
  const parsed = schema.safeParse(query)
  if (parsed.success) return parsed.data

  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: '查询参数无效',
      details: serializeValidationIssues(parsed.error),
    },
  })
  return null
}

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

export function createDoctorDashboardRouter({ allowedOrigins }) {
  const router = Router()
  const originGuard = createOriginGuard(allowedOrigins)

  router.use(loadAuthentication, requireAuthentication, requireRole('DOCTOR'))
  router.use((req, res, next) => {
    void req
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.get('/dashboard', async (req, res, next) => {
    try {
      const input = parseQuery(dashboardQuerySchema, res, req.query)
      if (!input) return
      res.json({ dashboard: await getDoctorDashboard(req.auth.user, input) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/training-records', async (req, res, next) => {
    try {
      const input = parseQuery(trainingRecordsQuerySchema, res, req.query)
      if (!input) return
      res.json(await listDoctorTrainingRecords(req.auth.user, input))
    } catch (error) {
      next(error)
    }
  })

  router.get('/patients', async (req, res, next) => {
    try {
      const input = parseQuery(patientsQuerySchema, res, req.query)
      if (!input) return
      res.json(await listDoctorPatients(req.auth.user, input))
    } catch (error) {
      next(error)
    }
  })

  router.post('/patients', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(assignPatientSchema, res, req.body)
      if (!input) return
      res.status(201).json({
        assignment: await assignPatientToDoctor(req.auth.user, input),
      })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/patients/:patientId/profile', originGuard, async (req, res, next) => {
    try {
      const input = parseBody(patientProfileSchema, res, req.body)
      if (!input) return
      res.json({
        profile: await updateDoctorPatientProfile(
          req.auth.user,
          Number(req.params.patientId),
          input,
        ),
      })
    } catch (error) {
      next(error)
    }
  })

  router.get('/patients/:patientId/overview', async (req, res, next) => {
    try {
      const input = parseQuery(patientOverviewQuerySchema, res, req.query)
      if (!input) return
      res.json(
        await getDoctorPatientOverview(req.auth.user, Number(req.params.patientId), input),
      )
    } catch (error) {
      next(error)
    }
  })

  router.get('/conversations', async (req, res, next) => {
    try {
      const input = parseQuery(conversationSummariesQuerySchema, res, req.query)
      if (!input) return
      res.json(await listDoctorConversationSummaries(req.auth.user, input))
    } catch (error) {
      next(error)
    }
  })

  router.get('/conversations/:sessionId', async (req, res, next) => {
    try {
      res.json({
        conversation: await getDoctorConversation(req.auth.user, req.params.sessionId),
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
