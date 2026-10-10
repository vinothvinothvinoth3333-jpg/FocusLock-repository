import { useEffect, useRef, useState } from 'react'
import AudioControls from './AudioControls.jsx'
import FocusAlert from './FocusAlert.jsx'
import HealthMeter from './HealthMeter.jsx'
import MemberList from './MemberList.jsx'
import Scorecard from './Scorecard.jsx'
import socket from '../socket.js'
import { playFocusAlertSound } from '../audio/focusAlertAudio.js'

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function SprintRoom({
  room,
  token,
  error,
  currentSocketId,
  alert,
  onDismissAlert,
  alertSoundEnabled,
  onAlertSoundChange,
  resumeNotice,
  onLeave,
  onUnauthorized,
}) {
  const [now, setNow] = useState(room.sprint.startTime || 0)
  const lastAlertId = useRef(null)
  const isHost = room.members.some(
    (member) => member.socketId === currentSocketId && member.isHost,
  )
  const isCompleted =
    room.sprint.status === 'completed'
  const remainingTime =
    room.sprint.status === 'paused'
      ? room.sprint.remainingMs
      : room.sprint.status === 'running'
        ? Math.max(0, room.sprint.endTime - now)
        : 0

  useEffect(() => {
    if (room.sprint.status !== 'running') {
      return undefined
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(intervalId)
  }, [room.sprint.status, room.sprint.endTime])

  useEffect(() => {
    if (!alert || lastAlertId.current === alert.id) return
    lastAlertId.current = alert.id
    if (alertSoundEnabled) {
      playFocusAlertSound()
    }
  }, [alert, alertSoundEnabled])

  function prepareNextSprint() {
    socket.emit('reset-sprint')
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-300">
            Room: {room.roomCode}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            FocusLock Sprint
          </h1>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
        >
          Leave room
        </button>
      </div>

      <FocusAlert alert={alert} onDismiss={onDismissAlert} />
      {error && (
        <p
          className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-indigo-300/15 bg-indigo-300/[0.06] p-6 text-center sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
          {isCompleted
            ? 'Sprint Completed'
            : room.sprint.status === 'paused'
              ? 'Sprint Paused'
              : 'Sprint in Progress'}
        </p>
        <p
          className="mt-4 font-mono text-6xl font-semibold tracking-tight text-white sm:text-8xl"
          aria-live="off"
        >
          {isCompleted ? '00:00' : formatTime(remainingTime)}
        </p>
        <p className="mt-3 text-sm text-slate-400">
          {room.sprint.durationMinutes} minute
          {room.sprint.durationMinutes === 1 ? '' : 's'} sprint
        </p>
      </div>

      {isCompleted && room.sprint.databaseId && (
        <Scorecard
          sprintId={room.sprint.databaseId}
          token={token}
          onUnauthorized={onUnauthorized}
        />
      )}

      {resumeNotice && room.sprint.status === 'running' && (
        <p
          className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          All members returned. Sprint resumed.
        </p>
      )}

      {room.sprint.status === 'paused' && (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Waiting for:</p>
          <p className="mt-1">
            {room.members
              .filter((member) => member.focusStatus === 'away')
              .map((member) => member.name)
              .join(', ')}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-200">
          Mode: {room.sprint.mode}
        </span>
        {room.sprint.mode === 'hardcore' && (
          <span className="text-xs text-slate-400">
            {room.sprint.status === 'paused'
              ? 'The squad timer is paused until everyone returns.'
              : 'A distraction pauses the sprint for the entire squad.'}
          </span>
        )}
      </div>

      {room.sprint.status === 'completed' && isHost && (
        <button
          type="button"
          onClick={prepareNextSprint}
          className="mt-5 rounded-xl border border-indigo-300/20 bg-indigo-300/10 px-5 py-3 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-300/20"
        >
          Prepare Next Sprint
        </button>
      )}

      <HealthMeter health={room.sprint.squadHealth} />

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-300">
          {room.members.length}{' '}
          {room.members.length === 1 ? 'member' : 'members'}
        </span>
      </div>
      <MemberList
        members={room.members}
        currentSocketId={currentSocketId}
        goal=""
        onGoalChange={() => {}}
        onSaveGoal={() => {}}
        sprintStarted
      />
      <AudioControls
        alertSoundEnabled={alertSoundEnabled}
        onAlertSoundChange={onAlertSoundChange}
      />
    </section>
  )
}

export default SprintRoom
