import { useEffect, useState } from 'react'
import { apiRequest } from '../api.js'

const BADGE_ICONS = {
  'first-sprint': '🔥',
  'laser-focus': '🎯',
  'goal-crusher': '✅',
  'focus-warrior': '⚔️',
  'deep-focus': '✨',
}

function Scorecard({ sprintId, token, onUnauthorized }) {
  const [scorecard, setScorecard] = useState(null)
  const [goalCompleted, setGoalCompleted] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadScorecard() {
      try {
        const result = await apiRequest(`/api/sprints/${sprintId}/scorecard`, {
          token,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        setScorecard(result.scorecard)
        if (result.scorecard.goal_completion_submitted) {
          setGoalCompleted(result.scorecard.goal_completed)
        }
      } catch (requestError) {
        if (controller.signal.aborted) return
        if (requestError.status === 401) {
          onUnauthorized()
          return
        }
        setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    loadScorecard()
    return () => controller.abort()
  }, [sprintId, token, onUnauthorized])

  async function saveGoalCompletion() {
    if (goalCompleted === null) {
      setError('Choose whether you completed your goal.')
      return
    }

    setError('')
    setIsSaving(true)
    try {
      const result = await apiRequest(
        `/api/sprints/${sprintId}/goal-completion`,
        {
          token,
          method: 'POST',
          body: { goalCompleted },
        },
      )
      setScorecard(result.scorecard)
      setGoalCompleted(result.scorecard.goal_completed)
    } catch (requestError) {
      if (requestError.status === 401) {
        onUnauthorized()
      } else {
        setError(requestError.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function shareScorecard() {
    if (!scorecard) return
    const goalStatus = scorecard.goal_completion_submitted
      ? scorecard.goal_completed
        ? 'Completed'
        : 'Not Yet'
      : 'Not answered'
    const summary = [
      'FOCUSLOCK · SPRINT COMPLETE',
      `Focus Score: ${scorecard.final_focus_score}%`,
      `Goal: ${scorecard.goal_text || 'Goal not set'}`,
      `Goal Status: ${goalStatus}`,
      `Distractions: ${scorecard.distraction_count}`,
      `Sprint Duration: ${scorecard.duration_minutes} minutes`,
      `Mode: ${scorecard.mode}`,
      `Final Squad Health: ${scorecard.final_health}%`,
      `Badges: ${scorecard.new_badges.map((badge) => badge.name).join(', ') || 'None yet'}`,
    ].join('\n')

    setShareMessage('')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FocusLock Sprint Scorecard', text: summary })
        setShareMessage('Scorecard shared.')
      } else {
        await navigator.clipboard.writeText(summary)
        setShareMessage('Scorecard copied to clipboard.')
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        setShareMessage('Could not share the scorecard from this browser.')
      }
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-indigo-300/20 bg-indigo-300/[0.06] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
        FocusLock · Sprint Complete
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Your Scorecard</h2>

      {isLoading && (
        <p className="mt-5 text-sm text-slate-400" role="status">
          Loading your saved sprint result…
        </p>
      )}
      {error && (
        <p
          className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}
      {!isLoading && !scorecard && !error && (
        <p className="mt-5 text-sm text-slate-400">
          This sprint result is not available yet.
        </p>
      )}

      {scorecard && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] bg-slate-950/40 p-4">
              <p className="text-xs text-slate-500">Focus Score</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-300">
                {scorecard.final_focus_score}%
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-slate-950/40 p-4">
              <p className="text-xs text-slate-500">Distractions</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {scorecard.distraction_count}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-slate-950/40 p-4">
              <p className="text-xs text-slate-500">Squad Health</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {scorecard.final_health}%
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={shareScorecard}
            className="mt-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-indigo-300/40 hover:bg-slate-700"
          >
            Share Scorecard
          </button>
          {shareMessage && (
            <p className="mt-2 text-sm text-slate-400" role="status">
              {shareMessage}
            </p>
          )}

          <dl className="mt-4 grid gap-4 rounded-xl border border-white/[0.07] bg-slate-950/40 p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Goal
              </dt>
              <dd className="mt-1 text-sm leading-6 text-slate-200">
                {scorecard.goal_text || 'Goal not set'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sprint Details
              </dt>
              <dd className="mt-1 text-sm text-slate-200">
                {scorecard.duration_minutes} minute
                {scorecard.duration_minutes === 1 ? '' : 's'} ·{' '}
                <span className="capitalize">{scorecard.mode}</span>
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-slate-950/40 p-4">
            <p className="text-sm font-semibold text-white">
              Did you complete your goal?
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                aria-pressed={goalCompleted === true}
                onClick={() => setGoalCompleted(true)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                  goalCompleted === true
                    ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-200'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Yes, Completed
              </button>
              <button
                type="button"
                aria-pressed={goalCompleted === false}
                onClick={() => setGoalCompleted(false)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                  goalCompleted === false
                    ? 'border-amber-300/40 bg-amber-300/10 text-amber-100'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Not Yet
              </button>
              <button
                type="button"
                onClick={saveGoalCompletion}
                disabled={isSaving || goalCompleted === null}
                className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? 'Saving…' : 'Save Answer'}
              </button>
            </div>
            {scorecard.goal_completion_submitted && (
              <p className="mt-3 text-sm text-slate-400" role="status">
                Saved as:{' '}
                <span className="font-medium text-slate-200">
                  {scorecard.goal_completed ? 'Completed' : 'Not Yet'}
                </span>
              </p>
            )}
          </div>

          {scorecard.new_badges.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-4">
              <h3 className="font-semibold text-amber-100">
                {scorecard.new_badges.length === 1
                  ? 'New Badge Earned'
                  : 'New Badges Earned'}
              </h3>
              <ul className="mt-3 space-y-3">
                {scorecard.new_badges.map((badge) => (
                  <li key={badge.code} className="flex items-start gap-3">
                    <span aria-hidden="true" className="text-xl">
                      {BADGE_ICONS[badge.code] || '🏅'}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        {badge.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-400">
                        {badge.description}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default Scorecard
