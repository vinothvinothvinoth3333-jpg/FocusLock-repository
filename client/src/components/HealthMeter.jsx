function HealthMeter({ health }) {
  let stateLabel = 'Healthy focus'
  let colorClass = 'bg-emerald-400'
  let textClass = 'text-emerald-300'

  if (health < 40) {
    stateLabel = 'Critical focus'
    colorClass = 'bg-red-400'
    textClass = 'text-red-300'
  } else if (health < 80) {
    stateLabel = 'Focus warning'
    colorClass = 'bg-amber-400'
    textClass = 'text-amber-300'
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-white">Squad Focus Health</h2>
        <span className={`text-sm font-semibold ${textClass}`}>
          {health}% · {stateLabel}
        </span>
      </div>
      <div
        className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800"
        role="meter"
        aria-label="Squad Focus Health"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={health}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${colorClass}`}
          style={{ width: `${health}%` }}
        />
      </div>
      {health === 0 && (
        <p className="mt-3 text-sm font-semibold text-red-300">
          Squad Focus Health Depleted
        </p>
      )}
    </section>
  )
}

export default HealthMeter
