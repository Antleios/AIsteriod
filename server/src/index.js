import express from 'express'
import gamesRouter from './routes/games.js'
import healthRouter from './routes/health.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(express.json())

app.use((req, res, next) => {
  const origin = req.get('origin')

  if (!origin || allowedOrigins.includes(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }

  next()
})

app.use('/api/health', healthRouter)
app.use('/api/games', gamesRouter)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((error, req, res, next) => {
  void req
  void next

  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, host, (error) => {
  if (error) {
    console.error(error)
    process.exit(1)
  }

  console.log(`AIsteriod API server listening on http://${host}:${port}`)
})
