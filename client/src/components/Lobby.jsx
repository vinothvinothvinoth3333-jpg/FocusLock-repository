import { useState } from 'react'
import FocusModeSelector from './FocusModeSelector.jsx'
import MemberList from './MemberList.jsx'
import socket from '../socket.js'
import { unlockFocusAlertAudio } from '../audio/focusAlertAudio.js'

const SPRINT_DURATIONS = [
  { label: '25 minutes', minutes: 25 },
  { label: '45 minutes', minutes: 45 },
  { label: '60 minutes', minutes: 60 },
  { label: '1 Minute Test', minutes: 1 },
]

function Lobby({ room, error, onClearError, onLeave }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [goal, setGoal] = useState(
    room.members.find((member) => member.socketId === socket.id)?.goal || '',
  )
  const currentMember = room.members.find(
    (member) => member.socketId === socket.id,
  )
  const isHost = currentMember?.isHost ?? false
  const sprint = room.sprint

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(room.roomCode)
      setCopyMessage('Room code copied')
    } catch {
      setCopyMessage('Could not copy the room code')
    }

    window.setTimeout(() => setCopyMessage(''), 2500)
  }

  function saveGoal() {
    onClearError()
    unlockFocusAlertAudio()
    socket.emit('set-goal', { goal })
  }

  function setDuration(event) {
    const durationMinutes = Number(event.target.value)
    onClearError()
    socket.emit('set-sprint-duration', { durationMinutes })
  }

  function setMode(mode) {
    onClearError()
    socket.emit('set-sprint-mode', { mode })
  }

  function startSprint() {
    onClearError()
    unlockFocusAlertAudio()
    socket.emit('start-sprint')
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-300">
            Room: {room.roomCode}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Study room lobby
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

      <div className="mt-7 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-5">
        <p className="text-sm font-semibold text-white">Set your study goal</p>
        <p className="mt-1 text-sm text-slate-400">
          Everyone needs a goal before the host can start.
        </p>

        {isHost ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label
                htmlFor="sprint-duration"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Sprint duration
              </label>
              <select
                id="sprint-duration"
                value={sprint?.durationMinutes ?? ''}
                onChange={setDuration}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-indigo-400"
              >
                <option value="" disabled>
                  Select a duration
                </option>
                {SPRINT_DURATIONS.map((duration) => (
                  <option key={duration.minutes} value={duration.minutes}>
                    {duration.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={startSprint}
              disabled={!sprint?.durationMinutes}
              className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Sprint
            </button>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-400">
            The host will choose a duration and start the sprint.
          </p>
        )}
        <FocusModeSelector
          mode={sprint?.mode || 'classic'}
          isHost={isHost}
          onChange={setMode}
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-300">
          {room.members.length}{' '}
          {room.members.length === 1 ? 'member' : 'members'}
        </span>
      </div>

      <MemberList
        members={room.members}
        currentSocketId={socket.id}
        goal={goal}
        onGoalChange={setGoal}
        onSaveGoal={saveGoal}
        sprintStarted={false}
      />

      {error && (
        <p
          className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}
      {copyMessage && (
        <p
          className={`mt-4 text-sm ${
            copyMessage === 'Room code copied'
              ? 'text-emerald-300'
              : 'text-red-300'
          }`}
          role="status"
          aria-live="polite"
        >
          {copyMessage}
        </p>
      )}

      <button
        type="button"
        onClick={copyRoomCode}
        className="mt-6 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
      >
        Copy Code
      </button>
    </section>
  )
}

export default Lobby
