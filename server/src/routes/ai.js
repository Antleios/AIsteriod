import { Router } from 'express'
import { getAiReply } from '../services/aiService.js'

const router = Router()

// POST /api/ai/chat  body: { messages: [{ role, content }] }  →  { reply }
router.post('/chat', async (req, res, next) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const reply = await getAiReply(messages)
    res.json({ reply })
  } catch (error) {
    next(error)
  }
})

export default router
