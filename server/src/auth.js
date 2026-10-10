import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createUser, getUserByEmail, getUserById } from './db.js'

const router = Router()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordRounds = 10
const exampleJwtSecret = 'replace_with_a_random_secret_at_least_32_characters_long'

class AuthenticationError extends Error {}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32 || secret === exampleJwtSecret) {
    throw new Error(
      'JWT_SECRET must be a private random value of at least 32 characters; do not use the example placeholder.',
    )
  }
  return secret
}

export function assertJwtSecretConfigured() {
  getJwtSecret()
}

export function createToken(user) {
  return jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' })
}

function tokenFromHeader(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim()
}

export function getUserFromToken(token) {
  if (!token) throw new AuthenticationError('Authentication required.')

  const secret = getJwtSecret()
  let payload
  try {
    payload = jwt.verify(token, secret)
  } catch {
    throw new AuthenticationError('Invalid authentication token.')
  }
  if (typeof payload !== 'object' || typeof payload.userId !== 'number') {
    throw new AuthenticationError('Invalid authentication token.')
  }
  const user = getUserById(payload.userId)
  if (!user) throw new AuthenticationError('User account no longer exists.')
  return user
}

export function requireAuth(request, response, next) {
  try {
    request.user = getUserFromToken(tokenFromHeader(request.headers.authorization))
    next()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      response.status(401).json({ error: 'Your login session is invalid or has expired. Please log in again.' })
      return
    }
    console.error('Authentication lookup failed:', error)
    response.status(500).json({ error: 'Could not verify your login. Please try again.' })
  }
}

export function authenticateSocket(socket, next) {
  try {
    socket.data.user = getUserFromToken(socket.handshake.auth?.token)
    next()
  } catch (error) {
    if (!(error instanceof AuthenticationError)) {
      console.error('Socket authentication lookup failed:', error)
      next(new Error('Authentication service unavailable.'))
      return
    }
    next(new Error('Authentication required. Please log in again.'))
  }
}

router.post('/register', (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  const email = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''

  if (!name || name.length > 30) {
    response.status(400).json({ error: 'Enter a name between 1 and 30 characters.' })
    return
  }
  if (!emailPattern.test(email) || email.length > 254) {
    response.status(400).json({ error: 'Enter a valid email address.' })
    return
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    response.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' })
    return
  }

  try {
    const passwordHash = bcrypt.hashSync(password, passwordRounds)
    const result = createUser({ name, email, passwordHash })
    response.status(201).json({
      message: 'Account created successfully.',
      user: { id: Number(result.lastInsertRowid), name, email },
    })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'An account with this email already exists.' })
      return
    }
    console.error('Account registration failed:', error)
    response.status(500).json({ error: 'Could not create the account. Please try again.' })
  }
})

router.post('/login', (request, response) => {
  const email = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''

  if (!email || !password) {
    response.status(400).json({ error: 'Enter your email and password.' })
    return
  }

  try {
    const user = getUserByEmail(email)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      response.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    response.json({
      token: createToken(user),
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (error) {
    console.error('Login failed:', error)
    response.status(500).json({ error: 'Could not log in. Please try again.' })
  }
})

router.get('/me', requireAuth, (request, response) => {
  response.json({
    user: {
      id: request.user.id,
      name: request.user.name,
      email: request.user.email,
    },
  })
})

export default router
