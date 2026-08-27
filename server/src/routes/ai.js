import { Router } from 'express'
import { loadAuthentication, requireAuthentication, requireRole } from '../middleware/auth.js'
import { createOriginGuard } from '../middleware/originGuard.js'
import { getAiChatResponse, isPatientInteractionProviderLive } from '../services/aiService.js'
import { createSessionInteraction } from '../services/aiInteractionService.js'
import {
  chatSchema,
  serializeValidationIssues,
  sessionInteractionSchema,
} from '../validation/aiSchemas.js'

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

export function createAiRouter({ allowedOrigins }) {
  const router = Router()
  const originGuard = createOriginGuard(allowedOrigins)

  router.use(loadAuthentication)
  router.use((req, res, next) => {
    void req
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  // Compatibility endpoint for the existing chat page. It keeps { reply } and
  // permits local deterministic development without login. Once Qwen is live,
  // require a patient session so the public endpoint cannot consume API quota.
  router.post('/chat', originGuard, async (req, res, next) => {
    try {
      if (isPatientInteractionProviderLive() && !req.auth) {
        requireAuthentication(req, res, () => {})
        return
      }
      if (isPatientInteractionProviderLive() && req.auth.user.role !== 'PATIENT') {
        requireRole('PATIENT')(req, res, () => {})
        return
      }

      const input = parseBody(chatSchema, res, req.body)
      if (!input) return
      const generated = await getAiChatResponse(input.messages)
      res.json({
        // Preserve the existing frontend contract while exposing the normalized
        // JSON output and prompt provenance to callers that need it.
        reply: generated.output.reply,
        emotion: generated.output.emotion,
        output: generated.output,
        ai: {
          provider: generated.provider,
          model: generated.model,
          prompt: generated.prompt,
          inputSchemaVersion: generated.inputSchemaVersion,
        },
      })
    } catch (error) {
      next(error)
    }
  })

  // The session-aware route is the production interaction path for both chat
  // and game prompts. It writes user/assistant turns and a durable audit row.
  router.post(
    '/sessions/:sessionId/interactions',
    originGuard,
    requireAuthentication,
    requireRole('PATIENT'),
    async (req, res, next) => {
      try {
        const input = parseBody(sessionInteractionSchema, res, req.body)
        if (!input) return
        const interaction = await createSessionInteraction(
          req.auth.user,
          req.params.sessionId,
          input,
        )
        res.status(201).json({ interaction })
      } catch (error) {
        next(error)
      }
    },
  )

  return router
}
