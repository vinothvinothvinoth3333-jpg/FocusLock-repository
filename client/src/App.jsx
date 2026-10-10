import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { apiRequest } from './api.js'
import AnalyticsDashboard from './components/AnalyticsDashboard.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import Dashboard from './components/Dashboard.jsx'
import Lobby from './components/Lobby.jsx'
import SprintRoom from './components/SprintRoom.jsx'
import StudyHistory from './components/StudyHistory.jsx'
import useFocusLock from './hooks/useFocusLock.js'
import socket from './socket.js'

function getStoredAuth() {
  const token = localStorage.getItem('focuslock_token')
  if (!token) return null

  try {
    return {
      token,
      user: JSON.parse(localStorage.getItem('focuslock_user') || 'null'),
    }
  } catch {
    return { token, user: null }
  }
}

function App() {
  const [auth, setAuth] = useState(getStoredAuth)
  const [isCheckingAuth, setIsCheckingAuth] = useState(
    () => Boolean(localStorage.getItem('focuslock_token')),
  )
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(
    () => (getStoredAuth() ? 'connecting' : 'disconnected'),
  )
  const [page, setPage] = useState('dashboard')
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const [focusAlert, setFocusAlert] = useState(null)
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(true)
  const [resumeNotice, setResumeNotice] = useState(null)
  const [needRefresh, setNeedRefresh] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true,
  )
  const updateServiceWorker = useRef(null)

  useFocusLock(room?.sprint)

  const hasStoredUser = Boolean(auth?.user)

  useEffect(() => {
    updateServiceWorker.current = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
    })
  }, [])

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }

    function handleAppInstalled() {
      setInstallPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function installFocusLock() {
    if (!installPrompt) return

    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  useEffect(() => {
    if (!isCheckingAuth || !auth?.token) return undefined

    const token = auth.token
    const controller = new AbortController()
    apiRequest('/api/auth/me', { token, signal: controller.signal })
      .then(({ user }) => {
        if (controller.signal.aborted) return
        localStorage.setItem('focuslock_user', JSON.stringify(user))
        setAuth({ token, user })
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return
        if (requestError.status === 401 || !hasStoredUser) {
          localStorage.removeItem('focuslock_token')
          localStorage.removeItem('focuslock_user')
          setAuth(null)
          setError(
            requestError.status === 401
              ? 'Your login session is invalid or has expired. Please log in again.'
              : requestError.message,
          )
        } else {
          setError(requestError.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsCheckingAuth(false)
      })

    return () => controller.abort()
  }, [auth?.token, hasStoredUser, isCheckingAuth])

  useEffect(() => {
    if (!auth?.token || isCheckingAuth) {
      socket.disconnect()
      return undefined
    }

    socket.auth = { token: auth.token }

    function handleConnect() {
      setIsConnected(true)
      setConnectionStatus('connected')
      setError('')
    }

    function handleDisconnect() {
      setIsConnected(false)
      setConnectionStatus(socket.active ? 'reconnecting' : 'disconnected')
    }

    function handleConnectError(connectionError) {
      setIsConnected(false)
      setConnectionStatus(socket.active ? 'reconnecting' : 'disconnected')
      if (connectionError.message.includes('Authentication required')) {
        localStorage.removeItem('focuslock_token')
        localStorage.removeItem('focuslock_user')
        setAuth(null)
        setRoom(null)
        setError('Your login session is invalid or has expired. Please log in again.')
      }
    }

    function handleReconnectAttempt() {
      setIsConnected(false)
      setConnectionStatus('reconnecting')
    }

    function handleReconnectFailed() {
      setIsConnected(false)
      setConnectionStatus('disconnected')
    }

    function handleRoomCreated(roomInfo) {
      setRoom(roomInfo)
      setError('')
    }

    function handleRoomJoined(roomInfo) {
      setRoom(roomInfo)
      setError('')
    }

    function handleRoomUpdated(roomInfo) {
      setRoom(roomInfo)
    }

    function handleSprintStarted(roomInfo) {
      setRoom(roomInfo)
      setResumeNotice(null)
    }

    function handleSprintEnded(roomInfo) {
      setRoom(roomInfo)
    }

    function handleSprintPaused(roomInfo) {
      setRoom(roomInfo)
    }

    function handleSprintResumed(roomInfo) {
      setRoom(roomInfo)
      setResumeNotice(Date.now())
      window.setTimeout(() => setResumeNotice(null), 3500)
    }

    function handleFocusStatusUpdated(roomInfo) {
      setRoom(roomInfo)
    }

    function handleSquadHealthUpdated(roomInfo) {
      setRoom(roomInfo)
    }

    function handleFocusAlert(alert) {
      setFocusAlert({ ...alert, id: Date.now() })
    }

    function handleRoomError(message) {
      setError(message)
    }

    function handleHistorySaveError(message) {
      setError(message)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.io.on('reconnect_attempt', handleReconnectAttempt)
    socket.io.on('reconnect_failed', handleReconnectFailed)
    socket.on('room-created', handleRoomCreated)
    socket.on('room-joined', handleRoomJoined)
    socket.on('room-updated', handleRoomUpdated)
    socket.on('sprint-started', handleSprintStarted)
    socket.on('sprint-ended', handleSprintEnded)
    socket.on('sprint-paused', handleSprintPaused)
    socket.on('sprint-resumed', handleSprintResumed)
    socket.on('sprint-mode-updated', handleRoomUpdated)
    socket.on('focus-status-updated', handleFocusStatusUpdated)
    socket.on('squad-health-updated', handleSquadHealthUpdated)
    socket.on('focus-alert', handleFocusAlert)
    socket.on('room-error', handleRoomError)
    socket.on('history-save-error', handleHistorySaveError)
    socket.connect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.io.off('reconnect_attempt', handleReconnectAttempt)
      socket.io.off('reconnect_failed', handleReconnectFailed)
      socket.off('room-created', handleRoomCreated)
      socket.off('room-joined', handleRoomJoined)
      socket.off('room-updated', handleRoomUpdated)
      socket.off('sprint-started', handleSprintStarted)
      socket.off('sprint-ended', handleSprintEnded)
      socket.off('sprint-paused', handleSprintPaused)
      socket.off('sprint-resumed', handleSprintResumed)
      socket.off('sprint-mode-updated', handleRoomUpdated)
      socket.off('focus-status-updated', handleFocusStatusUpdated)
      socket.off('squad-health-updated', handleSquadHealthUpdated)
      socket.off('focus-alert', handleFocusAlert)
      socket.off('room-error', handleRoomError)
      socket.off('history-save-error', handleHistorySaveError)
      socket.disconnect()
    }
  }, [auth?.token, isCheckingAuth])

  function handleAuthenticated(result) {
    localStorage.setItem('focuslock_token', result.token)
    localStorage.setItem('focuslock_user', JSON.stringify(result.user))
    setAuth({ token: result.token, user: result.user })
    setPage('dashboard')
    setError('')
  }

  function createRoom() {
    setError('')
    socket.emit('create-room')
  }

  function joinRoom(roomCode) {
    setError('')
    socket.emit('join-room', { roomCode })
  }

  function leaveRoom() {
    socket.emit('leave-room')
    setRoom(null)
    setPage('dashboard')
    setError('')
    setFocusAlert(null)
    setResumeNotice(null)
  }

  const logout = useCallback(() => {
    if (room) socket.emit('leave-room')
    socket.disconnect()
    localStorage.removeItem('focuslock_token')
    localStorage.removeItem('focuslock_user')
    setAuth(null)
    setRoom(null)
    setPage('dashboard')
    setError('')
    setFocusAlert(null)
    setResumeNotice(null)
  }, [room])

  const dismissFocusAlert = useCallback(() => {
    setFocusAlert(null)
  }, [])

  const handleExpiredSession = useCallback(() => {
    logout()
    setError('Your login session is invalid or has expired. Please log in again.')
  }, [logout])

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b1020] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-950/40">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
            >
              <path
                d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="15" r="1" fill="currentColor" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">FocusLock</span>
        </div>

        <div className="flex items-center gap-2">
          {!isInstalled && installPrompt && (
            <button
              type="button"
              onClick={installFocusLock}
              className="rounded-xl border border-indigo-300/25 bg-indigo-300/10 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-300/20 sm:text-sm"
            >
              Install FocusLock
            </button>
          )}
          {auth && (
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium sm:text-sm ${
                connectionStatus === 'connected'
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
                    ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                    : 'border-red-400/20 bg-red-400/10 text-red-300'
              }`}
              role="status"
              aria-live="polite"
            >
              <span className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
              }`} />
              {connectionStatus === 'connected'
                ? 'Server Connected'
                : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
                  ? 'Reconnecting…'
                  : 'Server Disconnected'}
            </div>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-10 sm:px-10 sm:py-16">
        <div className="w-full">
          {needRefresh && (
            <div
              className="mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-300/25 bg-indigo-300/10 px-4 py-3 text-sm text-indigo-100"
              role="status"
            >
              <p>
                A FocusLock update is ready. Refresh when convenient; refreshing
                during a sprint will leave the current room.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateServiceWorker.current?.(true)}
                  className="rounded-lg bg-indigo-400 px-3 py-2 font-semibold text-slate-950 hover:bg-indigo-300"
                >
                  Update now
                </button>
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  className="rounded-lg border border-indigo-200/20 px-3 py-2 font-medium text-indigo-100 hover:bg-white/5"
                >
                  Later
                </button>
              </div>
            </div>
          )}
          {auth && !isCheckingAuth && connectionStatus !== 'connected' && (
            <div
              className="mx-auto mb-5 flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
              role="status"
              aria-live="polite"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              <span>
                {connectionStatus === 'reconnecting' ||
                connectionStatus === 'connecting'
                  ? 'FocusLock is reconnecting. Room actions and real-time updates may be temporarily unavailable.'
                  : 'The FocusLock server is unavailable. Check your connection; room actions and real-time updates are unavailable.'}
              </span>
            </div>
          )}
          {isCheckingAuth ? (
            <div
              className="mx-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-4 text-sm text-slate-300"
              role="status"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" />
              Loading FocusLock and checking your login session…
            </div>
          ) : !auth ? (
            <AuthScreen
              onAuthenticated={handleAuthenticated}
              sessionError={error}
            />
          ) : room ? (
            room.sprint?.status === 'running' ||
            room.sprint?.status === 'paused' ||
            room.sprint?.status === 'completed' ? (
              <SprintRoom
                room={room}
                token={auth.token}
                error={error}
                currentSocketId={socket.id}
                alert={focusAlert}
                onDismissAlert={dismissFocusAlert}
                alertSoundEnabled={alertSoundEnabled}
                onAlertSoundChange={setAlertSoundEnabled}
                resumeNotice={resumeNotice}
                onLeave={leaveRoom}
                onUnauthorized={handleExpiredSession}
              />
            ) : (
              <Lobby
                room={room}
                error={error}
                onClearError={() => setError('')}
                onLeave={leaveRoom}
              />
            )
          ) : page === 'history' ? (
            <StudyHistory
              token={auth.token}
              onBack={() => setPage('dashboard')}
              onUnauthorized={handleExpiredSession}
            />
          ) : page === 'analytics' ||
            page === 'badges' ||
            page === 'leaderboard' ? (
            <AnalyticsDashboard
              token={auth.token}
              page={page}
              onBack={() => setPage('dashboard')}
              onPageChange={setPage}
              onUnauthorized={handleExpiredSession}
            />
          ) : (
            <Dashboard
              user={auth.user}
              isConnected={isConnected}
              error={error}
              onCreateRoom={createRoom}
              onJoinRoom={joinRoom}
              onOpenHistory={() => setPage('history')}
              onOpenAnalytics={() => setPage('analytics')}
              onOpenBadges={() => setPage('badges')}
              onOpenLeaderboard={() => setPage('leaderboard')}
              onLogout={logout}
            />
          )}
        </div>
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 py-6 text-xs text-slate-600 sm:px-10">
        FocusLock · A better way to study together
      </footer>
    </main>
  )
}

export default App
