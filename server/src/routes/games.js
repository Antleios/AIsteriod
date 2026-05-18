import { Router } from 'express'
import {
  getColorLineRound,
  getGameWithQuestions,
  listGames,
} from '../services/gamesService.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const games = await listGames()
    res.json({ games })
  } catch (error) {
    next(error)
  }
})

router.get('/color-line/round', async (req, res, next) => {
  try {
    const round = await getColorLineRound()
    if (!round) {
      res.status(404).json({ error: 'Game not found' })
      return
    }

    res.json(round)
  } catch (error) {
    next(error)
  }
})

router.get('/:slug/questions', async (req, res, next) => {
  try {
    const game = await getGameWithQuestions(req.params.slug)
    if (!game) {
      res.status(404).json({ error: 'Game not found' })
      return
    }

    res.json(game)
  } catch (error) {
    next(error)
  }
})

export default router
