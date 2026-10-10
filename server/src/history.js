import { Router } from 'express'
import { getUserSprintHistory } from './db.js'
import { requireAuth } from './auth.js'

const router = Router()

router.get('/', requireAuth, (request, response) => {
  try {
    const sprints = getUserSprintHistory(request.user.id)
    response.json({ sprints })
  } catch (error) {
    console.error('Could not load sprint history:', error)
    response.status(500).json({ error: 'Could not load study history. Please try again.' })
  }
})

export default router
