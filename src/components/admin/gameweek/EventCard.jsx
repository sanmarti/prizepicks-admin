const TYPE_COLOR = {
  MATCH_RESULT: 'text-blue-400',
  GOALS:        'text-green-400',
  PLAYER_SCORE: 'text-purple-400',
  CLEAN_SHEET:  'text-yellow-400',
}

export default function EventCard({ event, onToggleOption, onUpdateEnergy }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
      <div className="px-4 py-3 bg-white/3 border-b border-white/8 flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">{event.fixture_name}</p>
          <p className={`text-xs mt-0.5 ${TYPE_COLOR[event.event_type] ?? 'text-gray-400'}`}>
            {event.event_type?.replace('_', ' ')}
            {event.player_name && ` · ${event.player_name}`}
          </p>
        </div>
        <span className="text-gray-500 text-xs">{event.match_time ? new Date(event.match_time).toLocaleString() : ''}</span>
      </div>

      <div className="divide-y divide-white/5">
        {(event.options ?? []).map((opt, idx) => (
          <div key={idx} className="px-4 py-3 flex items-center gap-4">
            <input
              type="checkbox"
              checked={opt.included !== false}
              onChange={() => onToggleOption?.(event.id, idx)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <span className="flex-1 text-sm text-gray-200">{opt.label}</span>
            {opt.prob != null && (
              <span className="text-xs text-gray-500 w-16 text-right">
                {(opt.prob * 100).toFixed(0)}%
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">⚡</span>
              <input
                type="number" min={1} max={9}
                value={opt.energy_cost ?? ''}
                onChange={(e) => onUpdateEnergy?.(event.id, idx, parseInt(e.target.value))}
                className="w-12 bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
