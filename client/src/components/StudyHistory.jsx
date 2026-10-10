import { useEffect, useState } from 'react'
import { apiRequest } from '../api.js'

function StudyHistory({ token, onBack, onUnauthorized }) {
  const [sprints, setSprints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadHistory() {
      try {
        const result = await apiRequest('/api/history', {
          token,
          signal: controller.signal,
        })
        setSprints(result.sprints)
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        if (requestError.status === 401) {
          onUnauthorized()
          return
        }
        setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    loadHistory()
    return () => controller.abort()
  }, [token, onUnauthorized])

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-300">Your progress</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Study History
          </h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
        >
          Back to Dashboard
        </button>
      </div>

      {isLoading && <p className="mt-8 text-sm text-slate-400">Loading your completed sprints…</p>}
      {error && (
        <p className="mt-8 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {!isLoading && !error && sprints.length === 0 && (
        <p className="mt-8 rounded-2xl border border-white/[0.07] bg-slate-950/40 px-5 py-6 text-sm text-slate-400">
          No completed sprints yet.
        </p>
      )}
      {!isLoading && !error && sprints.length > 0 && (
        <div className="mt-8 space-y-4">
          {sprints.map((sprint) => (
            <article
              key={sprint.sprint_id}
              className="rounded-2xl border border-white/[0.07] bg-slate-950/40 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-indigo-200">
                    {new Date(sprint.created_at).toLocaleString(undefined, {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    Room: {sprint.room_code}
                  </h2>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold capitalize text-slate-300">
                  {sprint.mode}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-300">
                Duration: {sprint.duration_minutes} min
              </p>
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Personal Goal
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  {sprint.goal_text || 'Goal not set'}
                </p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-500">Goal Status</dt>
                  <dd
                    className={`mt-1 font-semibold ${
                      sprint.goal_completion_submitted
                        ? sprint.goal_completed
                          ? 'text-emerald-300'
                          : 'text-amber-200'
                        : 'text-slate-400'
                    }`}
                  >
                    {sprint.goal_completion_submitted
                      ? sprint.goal_completed
                        ? 'Completed'
                        : 'Not Yet'
                      : 'Not answered'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Distractions</dt>
                  <dd className="mt-1 font-semibold text-slate-200">{sprint.distraction_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Focus Score</dt>
                  <dd className="mt-1 font-semibold text-emerald-300">{sprint.final_focus_score}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Squad Health</dt>
                  <dd className="mt-1 font-semibold text-slate-200">{sprint.final_health}%</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default StudyHistory
