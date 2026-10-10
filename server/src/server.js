import { randomBytes, randomUUID } from 'node:crypto'
import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import authRouter, {
  assertJwtSecretConfigured,
  authenticateSocket,
} from './auth.js'
import {
  areAllSprintGoalsSubmitted,
  roomCodeExists,
  saveCompletedSprint,
} from './db.js'
import historyRouter from './history.js'
import profileRouter from './profile.js'

const app = express()
const server = createServer(app)
const port = process.env.PORT || 3001
const configuredOrigins =
  process.env.CLIENT_ORIGIN ||
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173')
const clientOrigins = configuredOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const rooms = new Map()

function allowConfiguredOrigin(origin, callback) {
  callback(null, !origin || clientOrigins.includes(origin))
}

app.use(cors({ origin: allowConfiguredOrigin }))
app.use(express.json({ limit: '10kb' }))
app.use('/api/auth', authRouter)
app.use('/api/history', historyRouter)
app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})
app.use('/api', profileRouter)

const io = new Server(server, {
  cors: {
    origin: allowConfiguredOrigin,
    methods: ['GET', 'POST'],
  },
  allowRequest: (request, callback) => {
    allowConfiguredOrigin(request.headers.origin, callback)
  },
})

io.use(authenticateSocket)

function createRoomCode() {
  let roomCode

  do {
    const suffix = randomBytes(16).toString('hex').toUpperCase()
    roomCode = `FL-${suffix}`
  } while (rooms.has(roomCode) || roomCodeExists(roomCode))

  return roomCode
}

function getRoomInfo(room) {
  const publicSprint = { ...room.sprint }
  delete publicSprint.sessionId
  delete publicSprint.hostUserId
  delete publicSprint.historyMembers
  delete publicSprint.historySaved

  return {
    roomCode: room.roomCode,
    members: room.members.map((member) => ({
      socketId: member.socketId,
      userId: member.userId,
      name: member.name,
      isHost: member.isHost,
      goal: member.goal,
      distractionCount: member.distractionCount,
      focusStatus: member.focusStatus,
    })),
    sprint: publicSprint,
  }
}

function broadcastRoom(room) {
  io.to(room.roomCode).emit('room-updated', getRoomInfo(room))
}

function completeSprint(roomCode) {
  const room = rooms.get(roomCode)
  if (
    !room ||
    (room.sprint.status !== 'running' && room.sprint.status !== 'paused')
  ) return

  const completedAt = Date.now()
  room.sprint.status = 'completed'
  room.sprint.remainingMs = 0
  room.sprint.endTime = completedAt
  room.sprint.pausedAt = null
  room.sprintTimer = null
  try {
    const savedSprint = saveCompletedSprint(room, completedAt)
    room.sprint.databaseId = savedSprint.sprintId
    room.sprint.historySaved = true
  } catch (error) {
    console.error(`Could not save completed sprint ${room.sprint.sessionId}:`, error)
    io.to(roomCode).emit(
      'history-save-error',
      'The sprint completed, but its history could not be saved. Please notify the project administrator.',
    )
  }
  const roomInfo = getRoomInfo(room)
  io.to(roomCode).emit('sprint-ended', roomInfo)
  broadcastRoom(room)
  console.log(`Sprint completed in room: ${roomCode}`)
}

function scheduleSprintCompletion(room) {
  if (room.sprintTimer) clearTimeout(room.sprintTimer)
  room.sprintTimer = setTimeout(
    () => {
      if (Date.now() < room.sprint.endTime) {
        scheduleSprintCompletion(room)
      } else {
        completeSprint(room.roomCode)
      }
    },
    Math.max(0, room.sprint.endTime - Date.now()),
  )
}

function resumePausedSprint(room) {
  if (room.sprint.status !== 'paused') return false
  if (room.members.some((member) => member.focusStatus === 'away')) return false
  if (room.sprint.remainingMs <= 0) {
    completeSprint(room.roomCode)
    return false
  }

  room.sprint.status = 'running'
  room.sprint.endTime = Date.now() + room.sprint.remainingMs
  room.sprint.remainingMs = null
  room.sprint.pausedAt = null
  const roomInfo = getRoomInfo(room)
  io.to(room.roomCode).emit('sprint-resumed', roomInfo)
  broadcastRoom(room)
  scheduleSprintCompletion(room)
  return true
}

function broadcastFocusStatus(room) {
  const roomInfo = getRoomInfo(room)
  io.to(room.roomCode).emit('focus-status-updated', roomInfo)
  io.to(room.roomCode).emit('room-updated', roomInfo)
}

function removeSocketFromRoom(socket) {
  const roomCode = socket.data.roomCode
  if (!roomCode) return

  const room = rooms.get(roomCode)
  delete socket.data.roomCode
  socket.leave(roomCode)

  if (!room) return

  room.members = room.members.filter((member) => member.socketId !== socket.id)

  if (room.members.length === 0) {
    if (room.sprintTimer) clearTimeout(room.sprintTimer)
    rooms.delete(roomCode)
    console.log(`Room deleted: ${roomCode}`)
    return
  }

  if (room.hostId === socket.id) {
    room.hostId = room.members[0].socketId
    room.members = room.members.map((member) => ({
      ...member,
      isHost: member.socketId === room.hostId,
    }))
  }

  if (room.sprint.status === 'paused') {
    resumePausedSprint(room)
  }
  broadcastRoom(room)
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('create-room', () => {
    if (socket.data.roomCode) {
      socket.emit('room-error', 'You are already in a room.')
      return
    }

    const user = socket.data.user

    const roomCode = createRoomCode()
    const room = {
      roomCode,
      createdAt: new Date().toISOString(),
      hostId: socket.id,
      members: [{
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        isHost: true,
        goal: '',
        distractionCount: 0,
        focusStatus: 'focused',
        lastDistractionAt: 0,
      }],
      sprint: {
        status: 'waiting',
        mode: 'classic',
        durationMinutes: null,
        startTime: null,
        endTime: null,
        remainingMs: null,
        pausedAt: null,
        sessionId: null,
        hostUserId: null,
        historyMembers: [],
        historySaved: false,
        databaseId: null,
        squadHealth: 100,
        totalDistractions: 0,
      },
      sprintTimer: null,
    }

    rooms.set(roomCode, room)
    socket.data.roomCode = roomCode
    socket.join(roomCode)
    socket.emit('room-created', getRoomInfo(room))
    console.log(`Room created: ${roomCode} by ${user.name}`)
  })

  socket.on('join-room', ({ roomCode } = {}) => {
    if (socket.data.roomCode) {
      socket.emit('room-error', 'You are already in a room.')
      return
    }

    const user = socket.data.user
    const cleanRoomCode =
      typeof roomCode === 'string' ? roomCode.trim().toUpperCase() : ''

    if (!cleanRoomCode) {
      socket.emit('room-error', 'Please enter a room code.')
      return
    }

    const room = rooms.get(cleanRoomCode)
    if (!room) {
      socket.emit('room-error', 'Room not found')
      return
    }
    if (room.sprint.status !== 'waiting') {
      socket.emit('room-error', 'This sprint has already started.')
      return
    }
    if (room.members.some((member) => member.userId === user.id)) {
      socket.emit('room-error', 'You already joined this room.')
      return
    }

    room.members.push({
      socketId: socket.id,
      userId: user.id,
      name: user.name,
      isHost: false,
      goal: '',
      distractionCount: 0,
      focusStatus: 'focused',
      lastDistractionAt: 0,
    })
    socket.data.roomCode = cleanRoomCode
    socket.join(cleanRoomCode)

    socket.emit('room-joined', getRoomInfo(room))
    broadcastRoom(room)
    console.log(`${user.name} joined room: ${cleanRoomCode}`)
  })

  socket.on('leave-room', () => {
    removeSocketFromRoom(socket)
  })

  socket.on('set-goal', ({ goal } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) {
      socket.emit('room-error', 'You are not in a room.')
      return
    }
    if (room.sprint.status !== 'waiting') {
      socket.emit('room-error', 'Goals cannot be changed after the sprint starts.')
      return
    }

    const cleanGoal = typeof goal === 'string' ? goal.trim() : ''
    if (!cleanGoal) {
      socket.emit('room-error', 'Please enter a study goal.')
      return
    }

    const member = room.members.find((item) => item.socketId === socket.id)
    if (!member) {
      socket.emit('room-error', 'You are not a member of this room.')
      return
    }

    member.goal = cleanGoal.slice(0, 120)
    broadcastRoom(room)
  })

  socket.on('set-sprint-duration', ({ durationMinutes } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) {
      socket.emit('room-error', 'You are not in a room.')
      return
    }
    if (room.hostId !== socket.id) {
      socket.emit('room-error', 'Only the host can choose the sprint duration.')
      return
    }
    if (room.sprint.status !== 'waiting') {
      socket.emit('room-error', 'The sprint has already started.')
      return
    }

    const allowedDurations = [1, 25, 45, 60]
    if (!allowedDurations.includes(Number(durationMinutes))) {
      socket.emit('room-error', 'Choose a valid sprint duration.')
      return
    }

    room.sprint.durationMinutes = Number(durationMinutes)
    broadcastRoom(room)
  })

  socket.on('set-sprint-mode', ({ mode } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) {
      socket.emit('room-error', 'You are not in a room.')
      return
    }
    if (room.hostId !== socket.id) {
      socket.emit('room-error', 'Only the host can choose the focus mode.')
      return
    }
    if (room.sprint.status !== 'waiting') {
      socket.emit('room-error', 'The focus mode cannot be changed after the sprint starts.')
      return
    }
    if (mode !== 'classic' && mode !== 'hardcore') {
      socket.emit('room-error', 'Choose Classic Mode or Hardcore Mode.')
      return
    }

    room.sprint.mode = mode
    const roomInfo = getRoomInfo(room)
    io.to(room.roomCode).emit('sprint-mode-updated', roomInfo)
    broadcastRoom(room)
  })

  socket.on('start-sprint', () => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) {
      socket.emit('room-error', 'You are not in a room.')
      return
    }
    if (room.hostId !== socket.id) {
      socket.emit('room-error', 'Only the host can start the sprint.')
      return
    }
    if (room.sprint.status !== 'waiting') {
      socket.emit('room-error', 'The sprint has already started.')
      return
    }
    if (!room.sprint.durationMinutes) {
      socket.emit('room-error', 'Select a sprint duration before starting.')
      return
    }
    if (room.members.some((member) => !member.goal?.trim())) {
      socket.emit('room-error', 'All members must set a goal before starting.')
      return
    }

    const startTime = Date.now()
    const endTime = startTime + room.sprint.durationMinutes * 60 * 1000
    room.sprint.squadHealth = 100
    room.sprint.totalDistractions = 0
    room.members = room.members.map((member) => ({
      ...member,
      distractionCount: 0,
      focusStatus: 'focused',
      lastDistractionAt: 0,
    }))
    room.sprint.status = 'running'
    room.sprint.startTime = startTime
    room.sprint.endTime = endTime
    room.sprint.remainingMs = null
    room.sprint.pausedAt = null
    room.sprint.sessionId = randomUUID()
    room.sprint.hostUserId = room.members.find(
      (member) => member.socketId === room.hostId,
    )?.userId
    room.sprint.historyMembers = room.members.map((member) => ({
      socketId: member.socketId,
      userId: member.userId,
      goal: member.goal,
      distractionCount: 0,
    }))
    room.sprint.historySaved = false
    room.sprint.databaseId = null

    const roomInfo = getRoomInfo(room)
    io.to(room.roomCode).emit('sprint-started', roomInfo)
    broadcastRoom(room)
    scheduleSprintCompletion(room)
    console.log(`Sprint started in room: ${room.roomCode}`)
  })

  socket.on('reset-sprint', () => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) {
      socket.emit('room-error', 'You are not in a room.')
      return
    }
    if (room.hostId !== socket.id) {
      socket.emit('room-error', 'Only the host can prepare another sprint.')
      return
    }
    if (room.sprint.status !== 'completed') {
      socket.emit('room-error', 'The sprint must be completed before resetting.')
      return
    }
    if (
      !room.sprint.databaseId ||
      !areAllSprintGoalsSubmitted(room.sprint.databaseId)
    ) {
      socket.emit(
        'room-error',
        'Every member must submit their goal completion before starting another sprint.',
      )
      return
    }

    room.sprint = {
      ...room.sprint,
      status: 'waiting',
      mode: 'classic',
      startTime: null,
      endTime: null,
      remainingMs: null,
      pausedAt: null,
      sessionId: null,
      hostUserId: null,
      historyMembers: [],
      historySaved: false,
      databaseId: null,
      squadHealth: 100,
      totalDistractions: 0,
    }
    room.members = room.members.map((member) => ({
      ...member,
      distractionCount: 0,
      focusStatus: 'focused',
      lastDistractionAt: 0,
    }))
    broadcastRoom(room)
  })

  socket.on('user-distracted', () => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) return

    if (room.sprint.status !== 'running' && room.sprint.status !== 'paused') return
    if (room.sprint.status === 'running' && Date.now() >= room.sprint.endTime) {
      completeSprint(room.roomCode)
      return
    }

    const member = room.members.find((item) => item.socketId === socket.id)
    if (!member || member.focusStatus === 'away') return

    const now = Date.now()
    if (now - member.lastDistractionAt < 1000) return

    member.lastDistractionAt = now
    member.focusStatus = 'away'
    member.distractionCount += 1
    const historyMember = room.sprint.historyMembers.find(
      (item) => item.socketId === socket.id,
    )
    if (historyMember) historyMember.distractionCount += 1
    room.sprint.totalDistractions += 1
    room.sprint.squadHealth = Math.max(0, room.sprint.squadHealth - 20)

    if (room.sprint.mode === 'hardcore' && room.sprint.status === 'running') {
      room.sprint.remainingMs = Math.max(0, room.sprint.endTime - now)
      room.sprint.pausedAt = now
      room.sprint.endTime = null
      room.sprint.status = 'paused'
      if (room.sprintTimer) clearTimeout(room.sprintTimer)
      room.sprintTimer = null
    }

    const roomInfo = getRoomInfo(room)
    io.to(room.roomCode).emit('focus-status-updated', roomInfo)
    io.to(room.roomCode).emit('squad-health-updated', roomInfo)
    io.to(room.roomCode).emit('room-updated', roomInfo)
    io.to(room.roomCode).emit('focus-alert', {
      name: member.name,
      squadHealth: room.sprint.squadHealth,
    })
    if (room.sprint.status === 'paused') {
      io.to(room.roomCode).emit('sprint-paused', getRoomInfo(room))
    }
  })

  socket.on('user-returned', () => {
    const room = rooms.get(socket.data.roomCode)
    if (
      !room ||
      (room.sprint.status !== 'running' && room.sprint.status !== 'paused')
    ) return
    if (room.sprint.status === 'running' && Date.now() >= room.sprint.endTime) {
      completeSprint(room.roomCode)
      return
    }

    const member = room.members.find((item) => item.socketId === socket.id)
    if (!member || member.focusStatus !== 'away') return

    member.focusStatus = 'focused'
    broadcastFocusStatus(room)
    if (room.sprint.status === 'paused') {
      resumePausedSprint(room)
    }
  })

  socket.on('disconnect', () => {
    removeSocketFromRoom(socket)
    console.log(`Client disconnected: ${socket.id}`)
  })
})

assertJwtSecretConfigured()
if (process.env.NODE_ENV === 'production' && clientOrigins.length === 0) {
  throw new Error('CLIENT_ORIGIN must contain the production frontend origin.')
}

server.listen(port, () => {
  console.log(`FocusLock server listening on port ${port}`)
})
