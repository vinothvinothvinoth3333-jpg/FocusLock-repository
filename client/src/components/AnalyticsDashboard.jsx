import { useEffect, useState } from 'react'
import { apiRequest } from '../api.js'

const ANALYTICS_METRICS = [
  { key: 'total_focus_minutes', label: 'Total Focus Time', format: (value) => `${Math.floor(value / 60)} h ${value % 60} min` },
  { key: 'total_completed_sprints', label: 'Completed Sprints', format: (value) => value },
  { key: 'average_focus_score', label: 'Average Focus Score', format: (value) => `${value}%` },
  { key: 'total_distractions', label: 'Total Distractions', format: (value) => value },
  { key: 'goals_completed', label: 'Goals Completed', format: (value, analytics) => `${value} / ${analytics.total_completed_sprints}` },
  { key: 'best_focus_score', label: 'Best Focus Score', format: (value) => `${value}%` },
]

const BADGE_ICONS = {
  'first-sprint': '🔥',
  'laser-focus': '🎯',
  'goal-crusher': '✅',
  'focus-warrior': '⚔️',
  'deep-focus': '✨',
}

function AnalyticsDashboard({ token, page, onBack, onPageChange, onUnauthorized }) {
  const [analytics, setAnalytics] = useState(null)
  const [badges, setBadges] = useState([])
  const [streaks, setStreaks] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const showBadges = page === 'badges'
  const showLeaderboard = page === 'leaderboard'

  useEffect(() => {
    const controller = new AbortController()

    async function loadProfile() {
      try {
        const [analyticsResult, badgeResult, streakResult, leaderboardResult] = await Promise.all([
          apiRequest('/api/analytics', { token, signal: controller.signal }),
          apiRequest('/api/badges', { token, signal: controller.signal }),
          apiRequest('/api/streaks', { token, signal: controller.signal }),
          apiRequest('/api/leaderboard', { token, signal: controller.signal }),
        ])
        if (controller.signal.aborted) return
        setAnalytics(analyticsResult.analytics)
        setBadges(badgeResult.badges)
        setStreaks(streakResult.streaks)
        setLeaderboard(leaderboardResult.leaderboard)
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

    loadProfile()
    return () => controller.abort()
  }, [token, onUnauthorized])

  return (
    <section className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-300">Your progress</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {showBadges ? 'My Badges' : showLeaderboard ? 'Leaderboard' : 'Analytics'}
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

      <div className="mt-6 flex gap-3 border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={() => onPageChange('analytics')}
          aria-pressed={!showBadges}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            !showBadges ? 'bg-indigo-400/15 text-indigo-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          Analytics
        </button>
        <button
          type="button"
          onClick={() => onPageChange('badges')}
          aria-pressed={showBadges}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            showBadges ? 'bg-indigo-400/15 text-indigo-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          My Badges
        </button>
        <button
          type="button"
          onClick={() => onPageChange('leaderboard')}
          aria-pressed={showLeaderboard}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            showLeaderboard ? 'bg-indigo-400/15 text-indigo-200' : 'text-slate-400 hover:text-white'
          }`}
        >
          Leaderboard
        </button>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-400">Loading your profile…</p>}
      {error && (
        <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && !showBadges && !showLeaderboard && analytics && streaks && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-orange-300/15 bg-orange-300/[0.05] p-5">
              <p className="text-sm text-orange-100/70">Current Streak</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                🔥 {streaks.current_streak} {streaks.current_streak === 1 ? 'Day' : 'Days'}
              </p>
              <p className="mt-2 text-xs text-orange-100/50">
                Active through today or yesterday
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-5">
              <p className="text-sm text-amber-100/70">Longest Streak</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                🏆 {streaks.longest_streak} {streaks.longest_streak === 1 ? 'Day' : 'Days'}
              </p>
              <p className="mt-2 text-xs text-amber-100/50">
                Consecutive UTC study days
              </p>
            </div>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ANALYTICS_METRICS.map((metric) => (
            <div key={metric.key} className="rounded-2xl border border-white/[0.07] bg-slate-950/40 p-5">
              <dt className="text-sm text-slate-400">{metric.label}</dt>
              <dd className="mt-2 text-2xl font-semibold text-white">
                {metric.format(analytics[metric.key], analytics)}
              </dd>
            </div>
          ))}
          </dl>
        </>
      )}

      {!isLoading && !error && showLeaderboard && (
        leaderboard.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-white/[0.07] bg-slate-950/40 px-5 py-6 text-sm text-slate-400">
            No completed sprints to rank yet.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.07]">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Rank</th>
                  <th scope="col" className="px-4 py-3">Study Partner</th>
                  <th scope="col" className="px-4 py-3">Focus Time</th>
                  <th scope="col" className="px-4 py-3">Sprints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] bg-slate-950/30">
                {leaderboard.map((entry, index) => (
                  <tr key={entry.user_id} className="text-slate-200">
                    <td className="px-4 py-4 font-semibold text-indigo-200">#{index + 1}</td>
                    <td className="px-4 py-4">{entry.name}</td>
                    <td className="px-4 py-4">{Math.floor(entry.total_focus_minutes / 60)} h {entry.total_focus_minutes % 60} min</td>
                    <td className="px-4 py-4">{entry.completed_sprints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500">
              Ranked by completed focus time, then by sprint count.
            </p>
          </div>
        )
      )}

      {!isLoading && !error && showBadges && (
        badges.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-white/[0.07] bg-slate-950/40 px-5 py-6 text-sm text-slate-400">
            No badges earned yet.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {badges.map((badge) => (
              <li key={badge.code} className="flex items-start gap-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5">
                <span className="text-2xl" aria-hidden="true">
                  {BADGE_ICONS[badge.code] || '🏅'}
                </span>
                <div>
                  <h2 className="font-semibold text-white">{badge.name}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{badge.description}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Earned {new Date(badge.earned_at).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  )
}

export default AnalyticsDashboard
