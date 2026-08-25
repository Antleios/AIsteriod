import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import aiRouter from './routes/ai.js'
import gamesRouter from './routes/games.js'
import healthRouter from './routes/health.js'
import { createAuthRouter } from './routes/auth.js'
import trainingRouter from './routes/training.js'

function getAllowedOrigins() {
  return (
    process.env.ALLOWED_ORIGINS ??
    'http://localhost:5173,http://localhost:5174,http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function createCorsMiddleware(allowedOrigins) {
  const allowed = new Set(allowedOrigins)

  return function corsMiddleware(req, res, next) {
    const origin = req.get('origin')

    if (!origin || allowed.has(origin)) {
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader('Vary', 'Origin')
      }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      )
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }

    next()
  }
}

export function createApp() {
  const app = express()
  const allowedOrigins = getAllowedOrigins()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(express.json({ limit: '16kb' }))
  app.use(cookieParser())
  app.use(createCorsMiddleware(allowedOrigins))

  app.use('/api/health', healthRouter)
  app.use('/api/auth', createAuthRouter({ allowedOrigins }))
  app.use('/api/games', gamesRouter)
  app.use('/api/ai', aiRouter)
  app.use('/api/training', trainingRouter)

  app.use((req, res) => {
    void req
    res.status(404).json({ error: 'Not found' })
  })

  app.use((error, req, res, next) => {
    void req
    void next

    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: '请求正文不是有效的 JSON',
        },
      })
      return
    }

    if (error?.status && error?.code) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message },
      })
      return
    }

    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
