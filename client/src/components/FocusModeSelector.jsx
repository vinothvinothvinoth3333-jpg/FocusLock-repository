const FOCUS_MODES = {
  classic: 'Distractions reduce Squad Health, but the timer continues.',
  hardcore: 'A distraction pauses the sprint for the entire squad.',
}

function FocusModeSelector({ mode, isHost, onChange }) {
  return (
    <div className="mt-5">
      <label
        htmlFor="focus-mode"
        className="mb-2 block text-sm font-medium text-slate-300"
      >
        Focus Mode
      </label>
      {isHost ? (
        <select
          id="focus-mode"
          value={mode}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-indigo-400"
        >
          <option value="classic">Classic Mode</option>
          <option value="hardcore">Hardcore Mode</option>
        </select>
      ) : (
        <p className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-200">
          {mode === 'hardcore' ? 'Hardcore Mode' : 'Classic Mode'}
        </p>
      )}
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {FOCUS_MODES[mode] || FOCUS_MODES.classic}
      </p>
    </div>
  )
}

export default FocusModeSelector
