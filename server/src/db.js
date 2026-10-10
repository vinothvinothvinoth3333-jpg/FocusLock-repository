import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url))
mkdirSync(dataDirectory, { recursive: true })

const databasePath = join(dirname(dataDirectory), 'data', 'focuslock.db')
const db = new Database(databasePath)

db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL UNIQUE,
    host_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    room_code TEXT NOT NULL,
    host_user_id INTEGER NOT NULL REFERENCES users(id),
    mode TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    final_health INTEGER NOT NULL,
    total_distractions INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS sprint_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    goal_text TEXT NOT NULL,
    distraction_count INTEGER NOT NULL,
    final_focus_score INTEGER NOT NULL,
    goal_completed INTEGER NOT NULL DEFAULT 0,
    goal_completion_submitted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id),
    source_sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
    earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(user_id, badge_id)
  );

  CREATE INDEX IF NOT EXISTS sprint_members_user_id_idx
    ON sprint_members(user_id);
`)

const sprintMemberColumns = new Set(
  db.prepare('PRAGMA table_info(sprint_members)').all().map((column) => column.name),
)
if (!sprintMemberColumns.has('goal_completion_submitted')) {
  db.exec(`
    ALTER TABLE sprint_members
    ADD COLUMN goal_completion_submitted INTEGER NOT NULL DEFAULT 0
  `)
}

const insertBadge = db.prepare(`
  INSERT INTO badges (code, name, description)
  VALUES (@code, @name, @description)
  ON CONFLICT(code) DO UPDATE SET
    name = excluded.name,
    description = excluded.description
`)

const badgeDefinitions = [
  {
    code: 'first-sprint',
    name: 'First Sprint',
    description: 'Completed your first study sprint.',
  },
  {
    code: 'laser-focus',
    name: 'Laser Focus',
    description: 'Completed a sprint with zero distractions.',
  },
  {
    code: 'goal-crusher',
    name: 'Goal Crusher',
    description: 'Marked your study goal as completed.',
  },
  {
    code: 'focus-warrior',
    name: 'Focus Warrior',
    description: 'Completed five study sprints.',
  },
  {
    code: 'deep-focus',
    name: 'Deep Focus',
    description: 'Earned a focus score of 90% or higher.',
  },
]

const seedBadges = db.transaction(() => {
  for (const badge of badgeDefinitions) insertBadge.run(badge)
})
seedBadges()

const findUserByEmail = db.prepare(`
  SELECT id, name, email, password_hash, created_at
  FROM users
  WHERE email = ?
`)

const findUserById = db.prepare(`
  SELECT id, name, email, created_at
  FROM users
  WHERE id = ?
`)

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash)
  VALUES (@name, @email, @passwordHash)
`)

const findSprintBySessionId = db.prepare(`
  SELECT id FROM sprints WHERE session_id = ?
`)

const findRoomByCode = db.prepare(`
  SELECT id FROM rooms WHERE room_code = ?
`)

const insertRoom = db.prepare(`
  INSERT OR IGNORE INTO rooms (room_code, host_user_id, created_at)
  VALUES (@roomCode, @hostUserId, @createdAt)
`)

const insertSprint = db.prepare(`
  INSERT INTO sprints (
    session_id, room_code, host_user_id, mode, duration_minutes,
    start_time, end_time, final_health, total_distractions, status
  )
  VALUES (
    @sessionId, @roomCode, @hostUserId, @mode, @durationMinutes,
    @startTime, @endTime, @finalHealth, @totalDistractions, 'completed'
  )
`)

const insertSprintMember = db.prepare(`
  INSERT INTO sprint_members (
    sprint_id, user_id, goal_text, distraction_count, final_focus_score
  )
  VALUES (@sprintId, @userId, @goalText, @distractionCount, @finalFocusScore)
`)

const awardBadge = db.prepare(`
  INSERT OR IGNORE INTO user_badges (user_id, badge_id, source_sprint_id)
  SELECT @userId, id, @sprintId
  FROM badges
  WHERE code = @code
`)

const getSprintBadgeAwards = db.prepare(`
  SELECT b.code, b.name, b.description
  FROM user_badges AS ub
  JOIN badges AS b ON b.id = ub.badge_id
  WHERE ub.user_id = @userId AND ub.source_sprint_id = @sprintId
  ORDER BY ub.id
`)

function awardCompletionBadges(userId, sprintId, sprintMember) {
  const completedSprints = db.prepare(`
    SELECT COUNT(*) AS count
    FROM sprint_members AS sm
    JOIN sprints AS s ON s.id = sm.sprint_id
    WHERE sm.user_id = ? AND s.status = 'completed'
  `).get(userId).count

  if (completedSprints === 1) awardBadge.run({ userId, sprintId, code: 'first-sprint' })
  if (completedSprints >= 5) awardBadge.run({ userId, sprintId, code: 'focus-warrior' })
  if (sprintMember.distractionCount === 0) {
    awardBadge.run({ userId, sprintId, code: 'laser-focus' })
  }
  if (sprintMember.finalFocusScore >= 90) {
    awardBadge.run({ userId, sprintId, code: 'deep-focus' })
  }

  return getSprintBadgeAwards.all({ userId, sprintId })
}

const saveSprintTransaction = db.transaction((room, completedAt) => {
  const existingSprint = findSprintBySessionId.get(room.sprint.sessionId)
  if (existingSprint) return { saved: false, sprintId: existingSprint.id }

  const hostUserId = room.sprint.hostUserId
  if (!hostUserId) {
    throw new Error(`Cannot save sprint ${room.sprint.sessionId}: room host is missing.`)
  }

  insertRoom.run({
    roomCode: room.roomCode,
    hostUserId,
    createdAt: room.createdAt,
  })

  const sprintResult = insertSprint.run({
    sessionId: room.sprint.sessionId,
    roomCode: room.roomCode,
    hostUserId,
    mode: room.sprint.mode,
    durationMinutes: room.sprint.durationMinutes,
    startTime: room.sprint.startTime,
    endTime: completedAt,
    finalHealth: room.sprint.squadHealth,
    totalDistractions: room.sprint.totalDistractions,
  })

  const sprintId = Number(sprintResult.lastInsertRowid)
  const memberBadges = new Map()
  for (const member of room.sprint.historyMembers) {
    const finalFocusScore = Math.max(0, 100 - member.distractionCount * 10)
    insertSprintMember.run({
      sprintId,
      userId: member.userId,
      goalText: member.goal,
      distractionCount: member.distractionCount,
      finalFocusScore,
    })
    memberBadges.set(
      member.userId,
      awardCompletionBadges(member.userId, sprintId, {
        distractionCount: member.distractionCount,
        finalFocusScore,
      }),
    )
  }

  return { saved: true, sprintId, memberBadges }
})

export function createUser(user) {
  return insertUser.run(user)
}

export function getUserByEmail(email) {
  return findUserByEmail.get(email)
}

export function getUserById(id) {
  return findUserById.get(id)
}

export function roomCodeExists(roomCode) {
  return Boolean(findRoomByCode.get(roomCode))
}

export function saveCompletedSprint(room, completedAt) {
  return saveSprintTransaction(room, completedAt)
}

const getScorecardQuery = db.prepare(`
  SELECT
    s.id AS sprint_id,
    s.room_code,
    s.mode,
    s.duration_minutes,
    s.start_time,
    s.end_time,
    s.final_health,
    s.total_distractions,
    s.status,
    s.created_at,
    sm.goal_text,
    sm.distraction_count,
    sm.final_focus_score,
    sm.goal_completed,
    sm.goal_completion_submitted
  FROM sprint_members AS sm
  JOIN sprints AS s ON s.id = sm.sprint_id
  WHERE s.id = @sprintId AND sm.user_id = @userId AND s.status = 'completed'
`)

function buildScorecard(userId, sprintId) {
  const scorecard = getScorecardQuery.get({ userId, sprintId })
  if (!scorecard) return null
  return {
    ...scorecard,
    goal_completed: Boolean(scorecard.goal_completed),
    goal_completion_submitted: Boolean(scorecard.goal_completion_submitted),
    new_badges: getSprintBadgeAwards.all({ userId, sprintId }),
  }
}

const updateGoalCompletionTransaction = db.transaction(
  (sprintId, userId, goalCompleted) => {
    const scorecard = getScorecardQuery.get({ sprintId, userId })
    if (!scorecard) return null

    db.prepare(`
      UPDATE sprint_members
      SET goal_completed = ?, goal_completion_submitted = 1
      WHERE sprint_id = ? AND user_id = ?
    `).run(Number(goalCompleted), sprintId, userId)

    if (goalCompleted) {
      awardBadge.run({ userId, sprintId, code: 'goal-crusher' })
    }

    return buildScorecard(userId, sprintId)
  },
)

export function getUserScorecard(sprintId, userId) {
  return buildScorecard(userId, sprintId)
}

export function saveGoalCompletion(sprintId, userId, goalCompleted) {
  return updateGoalCompletionTransaction(sprintId, userId, goalCompleted)
}

export function areAllSprintGoalsSubmitted(sprintId) {
  const result = db.prepare(`
    SELECT
      COUNT(*) AS total_members,
      SUM(goal_completion_submitted) AS submitted_members
    FROM sprint_members
    WHERE sprint_id = ?
  `).get(sprintId)

  return result.total_members > 0 &&
    result.submitted_members === result.total_members
}

export function getUserAnalytics(userId) {
  return db.prepare(`
    SELECT
      COALESCE(SUM(s.duration_minutes), 0) AS total_focus_minutes,
      COUNT(*) AS total_completed_sprints,
      COALESCE(ROUND(AVG(sm.final_focus_score)), 0) AS average_focus_score,
      COALESCE(SUM(sm.distraction_count), 0) AS total_distractions,
      COALESCE(SUM(sm.goal_completed), 0) AS goals_completed,
      COALESCE(MAX(sm.final_focus_score), 0) AS best_focus_score
    FROM sprint_members AS sm
    JOIN sprints AS s ON s.id = sm.sprint_id
    WHERE sm.user_id = ? AND s.status = 'completed'
  `).get(userId)
}

export function getUserStudyStreaks(userId, today = new Date()) {
  const studyDays = db.prepare(`
    SELECT DISTINCT date(s.end_time / 1000, 'unixepoch') AS study_day
    FROM sprint_members AS sm
    JOIN sprints AS s ON s.id = sm.sprint_id
    WHERE sm.user_id = ? AND s.status = 'completed'
    ORDER BY study_day
  `).all(userId).map(({ study_day: studyDay }) => studyDay)

  if (studyDays.length === 0) {
    return { current_streak: 0, longest_streak: 0, last_study_date: null }
  }

  const dayNumbers = studyDays.map((day) => {
    const [year, month, date] = day.split('-').map(Number)
    return Date.UTC(year, month - 1, date) / 86_400_000
  })

  let longestStreak = 1
  let currentRun = 1
  for (let index = 1; index < dayNumbers.length; index += 1) {
    currentRun = dayNumbers[index] === dayNumbers[index - 1] + 1
      ? currentRun + 1
      : 1
    longestStreak = Math.max(longestStreak, currentRun)
  }

  const todayNumber = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ) / 86_400_000
  const lastDayNumber = dayNumbers[dayNumbers.length - 1]
  let currentStreak = 0

  if (lastDayNumber >= todayNumber - 1) {
    currentStreak = 1
    for (let index = dayNumbers.length - 1; index > 0; index -= 1) {
      if (dayNumbers[index] !== dayNumbers[index - 1] + 1) break
      currentStreak += 1
    }
  }

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_study_date: studyDays[studyDays.length - 1],
  }
}

export function getLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT
      u.id AS user_id,
      u.name,
      COUNT(sm.id) AS completed_sprints,
      COALESCE(SUM(s.duration_minutes), 0) AS total_focus_minutes
    FROM sprint_members AS sm
    JOIN sprints AS s ON s.id = sm.sprint_id
    JOIN users AS u ON u.id = sm.user_id
    WHERE s.status = 'completed'
    GROUP BY u.id, u.name
    ORDER BY total_focus_minutes DESC, completed_sprints DESC, u.name COLLATE NOCASE ASC
    LIMIT ?
  `).all(limit)
}

export function getUserBadges(userId) {
  return db.prepare(`
    SELECT b.code, b.name, b.description, ub.earned_at
    FROM user_badges AS ub
    JOIN badges AS b ON b.id = ub.badge_id
    WHERE ub.user_id = ?
    ORDER BY ub.earned_at DESC, ub.id DESC
  `).all(userId)
}

export function getUserSprintHistory(userId) {
  return db.prepare(`
    SELECT
      s.id AS sprint_id,
      s.room_code,
      s.mode,
      s.duration_minutes,
      s.start_time,
      s.end_time,
      s.final_health,
      s.total_distractions,
      s.status,
      s.created_at,
      sm.goal_text,
      sm.distraction_count,
      sm.final_focus_score,
      sm.goal_completed,
      sm.goal_completion_submitted
    FROM sprint_members AS sm
    JOIN sprints AS s ON s.id = sm.sprint_id
    WHERE sm.user_id = ? AND s.status = 'completed'
    ORDER BY s.created_at DESC, s.id DESC
  `).all(userId)
}

export default db
