import { useState } from 'react'
import { apiRequest } from '../api.js'

function AuthScreen({ onAuthenticated, sessionError }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'register') {
        const result = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: { name, email, password },
        })
        setMessage(result.message)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
      } else {
        const result = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        onAuthenticated(result)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setMessage('')
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  const inputClassName =
    'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20'

  return (
    <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_0.85fr]">
      <div className="max-w-2xl">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-300/[0.07] px-4 py-2 text-sm text-indigo-200">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
          Your study space starts here
        </div>
        <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl">
          Make focus a
          <span className="block bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
            team effort.
          </span>
        </h1>
        <p className="mt-6 text-lg font-medium text-slate-200 sm:text-xl">
          Stay Focused. Stay Accountable.
        </p>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
          Sign in to create a shared study space, stay present with your
          classmates, and keep your completed sprint history.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-700 bg-slate-950/70 p-1">
          <button
            type="button"
            onClick={() => changeMode('login')}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              mode === 'login'
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => changeMode('register')}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              mode === 'register'
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        <h2 className="text-xl font-semibold text-white">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {mode === 'login'
            ? 'Log in to continue to your study dashboard.'
            : 'Your password is securely hashed before it is saved.'}
        </p>

        {sessionError && (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200" role="status">
            {sessionError}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === 'register' && (
            <div>
              <label htmlFor="account-name" className="mb-2 block text-sm font-medium text-slate-300">
                Name
              </label>
              <input
                id="account-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={30}
                autoComplete="name"
                required
                className={inputClassName}
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label htmlFor="account-email" className="mb-2 block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className={inputClassName}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="account-password" className="mb-2 block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
              className={inputClassName}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
            />
          </div>
          {mode === 'register' && (
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-300">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className={inputClassName}
                placeholder="Enter the password again"
              />
            </div>
          )}
          {message && (
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-50"
          >
            {isSubmitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Log In'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthScreen
