function MemberList({
  members,
  currentSocketId,
  goal,
  onGoalChange,
  onSaveGoal,
  sprintStarted,
}) {
  return (
    <ul className="mt-5 space-y-3">
      {members.map((member) => (
        <li
          key={member.socketId}
          className="rounded-2xl border border-white/[0.07] bg-slate-950/40 px-4 py-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-sm font-semibold text-indigo-200">
                {member.name.slice(0, 1).toUpperCase()}
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#11182a] bg-emerald-400"
                  aria-label="Online"
                  title="Online"
                />
              </span>
              <span className="truncate font-medium text-slate-100">
                {member.name}
              </span>
            </div>
            {member.isHost && (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200">
                HOST
              </span>
            )}
          </div>

          {member.socketId === currentSocketId && !sprintStarted ? (
            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                onSaveGoal()
              }}
            >
              <label htmlFor="study-goal" className="sr-only">
                Your study goal
              </label>
              <input
                id="study-goal"
                value={goal}
                onChange={(event) => onGoalChange(event.target.value)}
                maxLength={120}
                placeholder="What will you work on?"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-indigo-400"
              />
              <button
                type="submit"
                className="rounded-lg border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-400/20"
              >
                Save Goal
              </button>
            </form>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="break-words text-slate-400">
                <span className="font-medium text-slate-500">Goal: </span>
                {member.goal || 'Goal not set'}
              </p>
              {sprintStarted && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p
                    className={
                      member.focusStatus === 'away'
                        ? 'text-red-300'
                        : 'text-emerald-300'
                    }
                  >
                    <span aria-hidden="true">
                      {member.focusStatus === 'away' ? '🔴' : '🟢'}{' '}
                    </span>
                    {member.focusStatus === 'away' ? 'Away' : 'Focused'}
                  </p>
                  <p className="text-slate-500">
                    Distractions: {member.distractionCount || 0}
                  </p>
                </div>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default MemberList
