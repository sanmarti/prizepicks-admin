const COLORS = {
  ACTIVE:    'bg-green-500/15 text-green-400 border-green-500/20',
  PUBLISHED: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  DRAFT:     'bg-gray-500/15 text-gray-400 border-gray-500/20',
  LOCKED:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  FINISHED:  'bg-purple-500/15 text-purple-400 border-purple-500/20',
  LIVE:      'bg-red-500/15 text-red-400 border-red-500/20',
  PENDING:   'bg-gray-500/15 text-gray-400 border-gray-500/20',
  WON:       'bg-green-500/15 text-green-400 border-green-500/20',
  LOST:      'bg-red-500/15 text-red-400 border-red-500/20',
  admin:     'bg-purple-500/15 text-purple-400 border-purple-500/20',
  user:      'bg-gray-500/15 text-gray-400 border-gray-500/20',
  FREE:      'bg-gray-500/15 text-gray-400 border-gray-500/20',
  PAID:      'bg-green-500/15 text-green-400 border-green-500/20',
}

export default function StatusBadge({ status }) {
  const cls = COLORS[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status}
    </span>
  )
}
