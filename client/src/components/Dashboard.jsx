import { useState } from 'react'
import CreateRoom from './CreateRoom.jsx'
import JoinRoom from './JoinRoom.jsx'

function Dashboard({
  user,
  isConnected,
  error,
  onCreateRoom,
  onJoinRoom,
  onOpenHistory,
  onOpenAnalytics,
  onOpenBadges,
  onOpenLeaderboard,
  onLogout,
}) {
  const [roomCode, setRoomCode] = useState('')

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-300">Your dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Welcome, {user.name}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Log Out
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-indigo-300/15 bg-indigo-300/[0.06] p-5">
            <h2 className="font-semibold text-white">Start a study room</h2>
            <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">
              Create a room and invite classmates with its room code.
            </p>
            <div className="mt-5">
              <CreateRoom onCreate={onCreateRoom} disabled={!isConnected} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-slate-950/40 p-5">
            <h2 className="font-semibold text-white">Join a study room</h2>
            <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">
              Enter the room code shared by your host.
            </p>
            <div className="mt-5">
              <JoinRoom
                roomCode={roomCode}
                onRoomCodeChange={setRoomCode}
                onJoin={() => onJoinRoom(roomCode)}
                disabled={!isConnected}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={onOpenHistory}
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-100 transition hover:border-indigo-300/40 hover:bg-slate-700"
          >
            Study History
          </button>
          <button
            type="button"
            onClick={onOpenAnalytics}
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-100 transition hover:border-indigo-300/40 hover:bg-slate-700"
          >
            Analytics
          </button>
          <button
            type="button"
            onClick={onOpenBadges}
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-100 transition hover:border-indigo-300/40 hover:bg-slate-700"
          >
            My Badges
          </button>
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-100 transition hover:border-indigo-300/40 hover:bg-slate-700"
          >
            Leaderboard
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}

export default Dashboard
