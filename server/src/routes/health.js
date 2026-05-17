import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  void req

  res.json({
    status: 'ok',
    service: 'aisteriod-server',
    timestamp: new Date().toISOString(),
  })
})

export default router
