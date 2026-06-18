import { NavLink, useNavigate } from 'react-router'
import { useAdminAuthStore } from '../../../store/adminAuthStore'

const SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { icon: '📊', label: 'Dashboard',     path: '/admin/dashboard' },
      { icon: '👥', label: 'Users',         path: '/admin/users' },
      { icon: '🏆', label: 'Leagues',       path: '/admin/leagues' },
      { icon: '🌍', label: 'Competitions',  path: '/admin/competitions' },
    ],
  },
  {
    label: 'GAMEWEEKS',
    items: [
      { icon: '🏗️',  label: 'Builder',      path: '/admin/gameweeks/new' },
      { icon: '⚡', label: 'Odds Review',   path: '/admin/gameweeks' },
      { icon: '⚽', label: 'Event Editor',  path: '/admin/gameweeks' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { icon: '🎯', label: 'Scoring',   path: '/admin/scoring' },
      { icon: '💰', label: 'Payments',  path: '/admin/payments' },
    ],
  },
]

export default function AdminSidebar() {
  const { admin, logout } = useAdminAuthStore()
  const navigate = useNavigate()

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
      isActive
        ? 'bg-indigo-600 text-white font-medium'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`

  return (
    <aside className="fixed top-0 left-0 h-screen w-[240px] bg-[#0d1117] border-r border-white/8 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <div>
            <p className="text-white font-bold text-sm tracking-wider">PRIZEPICKS</p>
            <p className="text-gray-500 text-[10px] tracking-widest">ADMIN PANEL</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] text-gray-600 tracking-widest px-3 mb-2">{section.label}</p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink key={item.label + item.path} to={item.path} className={linkCls} end={item.path === '/admin/dashboard'}>
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {admin?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{admin?.email ?? 'admin'}</p>
            <p className="text-gray-500 text-[10px]">Administrator</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span>🚪</span> Sign out
        </button>
      </div>
    </aside>
  )
}
