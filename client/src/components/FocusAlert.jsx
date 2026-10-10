import { useEffect } from 'react'

function FocusAlert({ alert, onDismiss }) {
  useEffect(() => {
    if (!alert) return undefined

    const timeoutId = window.setTimeout(onDismiss, 4500)
    return () => window.clearTimeout(timeoutId)
  }, [alert, onDismiss])

  if (!alert) return null

  return (
    <div
      className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 shadow-lg shadow-red-950/20"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-red-200">Focus Interrupted</p>
      <p className="mt-1 text-sm text-red-100/80">
        {alert.name} left the FocusLock workspace.
      </p>
      <p className="mt-2 text-xs font-medium text-red-200/80">
        Squad Health: {alert.squadHealth}%
      </p>
    </div>
  )
}

export default FocusAlert
