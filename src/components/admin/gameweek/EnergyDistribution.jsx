export default function EnergyDistribution({ options = [] }) {
  const costs = options.map((o) => o.energy_cost).filter(Boolean)
  if (!costs.length) return null

  const min = Math.min(...costs)
  const max = Math.max(...costs)
  const avg = (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(1)

  const byType = options.reduce((acc, o) => {
    acc[o.event_type] = (acc[o.event_type] ?? 0) + 1
    return acc
  }, {})

  const dist = Array.from({ length: 9 }, (_, i) => i + 1).map((cost) => ({
    cost,
    count: costs.filter((c) => c === cost).length,
  }))
  const maxCount = Math.max(...dist.map((d) => d.count), 1)
  const hasWarning = costs.some((c) => c < 1 || c > 9)

  return (
    <div className="rounded-xl bg-white/3 border border-white/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-white text-sm font-medium">Energy Distribution</h4>
        {hasWarning && (
          <span className="text-yellow-400 text-xs">⚠ Energy out of range</span>
        )}
      </div>

      {/* Bar chart 1–9 */}
      <div className="flex items-end gap-1.5 h-16">
        {dist.map(({ cost, count }) => (
          <div key={cost} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-indigo-500 transition-all"
              style={{ height: count ? `${(count / maxCount) * 100}%` : '4px', opacity: count ? 1 : 0.15 }}
            />
            <span className="text-[9px] text-gray-500">{cost}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs">
        <div><span className="text-gray-500">Total</span><span className="ml-1 text-white font-medium">{options.length}</span></div>
        <div><span className="text-gray-500">Min</span><span className="ml-1 text-white font-medium">{min}</span></div>
        <div><span className="text-gray-500">Max</span><span className="ml-1 text-white font-medium">{max}</span></div>
        <div><span className="text-gray-500">Avg</span><span className="ml-1 text-white font-medium">{avg}</span></div>
      </div>

      {/* By type */}
      {Object.keys(byType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, count]) => (
            <span key={type} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-300">
              {type.replace('_', ' ')} · {count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
