import { useLocation } from 'react-router'

const TITLES = {
  '/admin/dashboard':  'Dashboard',
  '/admin/users':      'Users',
  '/admin/leagues':    'Leagues',
  '/admin/gameweeks':  'Gameweeks',
  '/admin/competitions': 'Competitions',
  '/admin/scoring':    'Scoring Monitor',
  '/admin/payments':   'Payments',
}

export default function AdminTopBar() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? (pathname.includes('/gameweeks/new') ? 'Gameweek Builder' : 'Admin')

  return (
    <header className="h-14 border-b border-white/8 flex items-center justify-between px-6 bg-[#0d1117]/80 backdrop-blur-sm sticky top-0 z-30">
      <h1 className="text-white font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
        <span className="text-gray-400 text-xs">Live</span>
      </div>
    </header>
  )
}
