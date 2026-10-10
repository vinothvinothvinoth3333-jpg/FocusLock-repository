import { Router } from 'express'
import {
  getUserAnalytics,
  getUserBadges,
  getLeaderboard,
  getUserScorecard,
  getUserStudyStreaks,
  saveGoalCompletion,
} from './db.js'
import { requireAuth } from './auth.js'

const router = Router()

router.use(requireAuth)

router.get('/analytics', (request, response) => {
  try {
    response.json({ analytics: getUserAnalytics(request.user.id) })
  } catch (error) {
    console.error('Could not load user analytics:', error)
    response.status(500).json({ error: 'Could not load analytics. Please try again.' })
  }
})

router.get('/badges', (request, response) => {
  try {
    response.json({ badges: getUserBadges(request.user.id) })
  } catch (error) {
    console.error('Could not load user badges:', error)
    response.status(500).json({ error: 'Could not load badges. Please try again.' })
  }
})

router.get('/streaks', (request, response) => {
  try {
    response.json({ streaks: getUserStudyStreaks(request.user.id) })
  } catch (error) {
    console.error('Could not load study streaks:', error)
    response.status(500).json({ error: 'Could not load study streaks. Please try again.' })
  }
})

router.get('/leaderboard', (request, response) => {
  try {
    response.json({ leaderboard: getLeaderboard() })
  } catch (error) {
    console.error('Could not load leaderboard:', error)
    response.status(500).json({ error: 'Could not load leaderboard. Please try again.' })
  }
})

router.get('/sprints/:sprintId/scorecard', (request, response) => {
  const sprintId = Number(request.params.sprintId)
  if (!Number.isSafeInteger(sprintId) || sprintId < 1) {
    response.status(400).json({ error: 'Invalid sprint ID.' })
    return
  }

  try {
    const scorecard = getUserScorecard(sprintId, request.user.id)
    if (!scorecard) {
      response.status(404).json({ error: 'Completed sprint not found for this account.' })
      return
    }
    response.json({ scorecard })
  } catch (error) {
    console.error('Could not load sprint scorecard:', error)
    response.status(500).json({ error: 'Could not load the scorecard. Please try again.' })
  }
})

router.post('/sprints/:sprintId/goal-completion', (request, response) => {
  const sprintId = Number(request.params.sprintId)
  const { goalCompleted } = request.body || {}

  if (!Number.isSafeInteger(sprintId) || sprintId < 1) {
    response.status(400).json({ error: 'Invalid sprint ID.' })
    return
  }
  if (typeof goalCompleted !== 'boolean') {
    response.status(400).json({ error: 'Choose whether you completed your goal.' })
    return
  }

  try {
    const scorecard = saveGoalCompletion(
      sprintId,
      request.user.id,
      goalCompleted,
    )
    if (!scorecard) {
      response.status(404).json({ error: 'Completed sprint not found for this account.' })
      return
    }
    response.json({ scorecard })
  } catch (error) {
    console.error('Could not save goal completion:', error)
    response.status(500).json({ error: 'Could not save your answer. Please try again.' })
  }
})

export default router
