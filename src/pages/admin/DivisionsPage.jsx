import { useState, useEffect, useCallback } from 'react'
import { listDivisions, createDivision, updateDivision, getDivisionUsers } from '../../api/divisions'

const DEFAULT_FORM = {
  name: '', display_order: '', icon: '🎓',
  color_primary: '#6366f1', color_secondary: '#4f46e5',
  is_initial: false, is_highest: false, allows_relegation: true,
  relegation_max_points: '', retention_min_points: '0',
  retention_max_points: '', promotion_min_points: '',
  is_active: true,
}

function DivisionCard({ div, onEdit, onViewUsers }) {
  return (
    <div className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{div.icon}</span>
          <div>
            <h3 className="text-white font-semibold text-sm">{div.name}</h3>
            <p className="text-gray-500 text-xs">Order #{div.display_order}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {div.is_initial && (
            <span className="text-[10px] bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">STARTER</span>
          )}
          {div.is_highest && (
            <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">ELITE</span>
          )}
          {!div.is_active && (
            <span className="text-[10px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">INACTIVE</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white/5 rounded-xl p-2">
          <p className="text-gray-500">Relegation</p>
          <p className="text-white font-medium mt-0.5">
            {div.allows_relegation && div.relegation_max_points !== null
              ? `≤ ${div.relegation_max_points} LP`
              : 'None'}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-2">
          <p className="text-gray-500">Retention</p>
          <p className="text-white font-medium mt-0.5">{div.retention_min_points}–{div.retention_max_points} LP</p>
        </div>
        <div className="bg-white/5 rounded-xl p-2">
          <p className="text-gray-500">Promotion</p>
          <p className="text-white font-medium mt-0.5">≥ {div.promotion_min_points} LP</p>
        </div>
      </div>

      <div className="flex items-center gap-1 h-1 rounded-full overflow-hidden">
        {div.allows_relegation && div.relegation_max_points !== null && (
          <div className="h-full bg-red-500/70" style={{ flex: div.relegation_max_points }} />
        )}
        <div className="h-full bg-gray-500/50"
          style={{ flex: div.retention_max_points - (div.relegation_max_points ?? -1) - 1 }} />
        <div className="h-full bg-green-500/70 min-w-[12px]" style={{ flex: 4 }} />
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onEdit(div)}
          className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs transition-colors"
        >
          Edit rules
        </button>
        <button
          onClick={() => onViewUsers(div.id)}
          className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs transition-colors"
        >
          View players
        </button>
      </div>
    </div>
  )
}

function DivisionForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const payload = {
        ...form,
        display_order: parseInt(form.display_order),
        relegation_max_points: form.relegation_max_points === '' ? null : parseInt(form.relegation_max_points),
        retention_min_points:  parseInt(form.retention_min_points || 0),
        retention_max_points:  parseInt(form.retention_max_points),
        promotion_min_points:  parseInt(form.promotion_min_points),
      }
      if (initial?.id) {
        await updateDivision(initial.id, payload)
      } else {
        await createDivision(payload)
      }
      onSave()
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500"
  const labelCls = "text-gray-400 text-xs mb-1 block"

  return (
    <form onSubmit={handleSubmit} className="bg-[#0d1117] border border-white/8 rounded-2xl p-5 flex flex-col gap-4">
      <h3 className="text-white font-semibold">{initial?.id ? 'Edit Division' : 'New Division'}</h3>

      {err && <p className="text-red-400 text-xs bg-red-900/20 p-2 rounded-xl">{err}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Division 1" required />
        </div>
        <div>
          <label className={labelCls}>Order</label>
          <input className={inputCls} type="number" value={form.display_order} onChange={e => set('display_order', e.target.value)} placeholder="1" required />
        </div>
        <div>
          <label className={labelCls}>Icon (emoji)</label>
          <input className={inputCls} value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🎓" />
        </div>
        <div>
          <label className={labelCls}>Color</label>
          <input className={inputCls} value={form.color_primary} onChange={e => set('color_primary', e.target.value)} placeholder="#6366f1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Relegation max LP (blank=none)</label>
          <input className={inputCls} type="number" value={form.relegation_max_points} onChange={e => set('relegation_max_points', e.target.value)} placeholder="9" />
        </div>
        <div>
          <label className={labelCls}>Retention min LP</label>
          <input className={inputCls} type="number" value={form.retention_min_points} onChange={e => set('retention_min_points', e.target.value)} placeholder="10" required />
        </div>
        <div>
          <label className={labelCls}>Retention max LP</label>
          <input className={inputCls} type="number" value={form.retention_max_points} onChange={e => set('retention_max_points', e.target.value)} placeholder="16" required />
        </div>
        <div>
          <label className={labelCls}>Promotion min LP</label>
          <input className={inputCls} type="number" value={form.promotion_min_points} onChange={e => set('promotion_min_points', e.target.value)} placeholder="17" required />
        </div>
      </div>

      <div className="flex gap-6 text-sm">
        {[['allows_relegation','Allow relegation'],['is_initial','Starter division'],['is_highest','Highest division'],['is_active','Active']].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500" />
            {label}
          </label>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save division'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function UsersModal({ divisionId, onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDivisionUsers(divisionId)
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [divisionId])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h3 className="text-white font-semibold text-sm">Players in division</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {loading && <p className="text-gray-500 text-sm text-center py-8">Loading…</p>}
          {!loading && users.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No players in this division yet</p>
          )}
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
              <div>
                <p className="text-white text-sm">{u.display_name || u.email}</p>
                <p className="text-gray-500 text-xs">{u.email}</p>
              </div>
              <div className="text-right">
                {u.current_sprint_lp !== null && (
                  <p className="text-indigo-400 text-sm font-medium">{u.current_sprint_lp} LP</p>
                )}
                {u.is_rookie && (
                  <span className="text-[10px] bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full">Rookie</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [usersDiv, setUsersDiv] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    listDivisions()
      .then(r => setDivisions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaved = () => {
    setShowForm(false)
    setEditTarget(null)
    load()
  }

  const handleEdit = (div) => {
    setEditTarget({
      ...div,
      relegation_max_points: div.relegation_max_points ?? '',
      retention_min_points: div.retention_min_points ?? 0,
      retention_max_points: div.retention_max_points ?? '',
      promotion_min_points: div.promotion_min_points ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Divisions</h1>
          <p className="text-gray-500 text-sm mt-0.5">Configure the 6 to Glory competitive ladder</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          + New division
        </button>
      </div>

      {(showForm) && (
        <DivisionForm
          initial={editTarget}
          onSave={handleSaved}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      {loading && (
        <div className="text-center text-gray-500 py-12">Loading divisions…</div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {divisions.map(div => (
            <DivisionCard
              key={div.id}
              div={div}
              onEdit={handleEdit}
              onViewUsers={(id) => setUsersDiv(id)}
            />
          ))}
        </div>
      )}

      {/* Point system info */}
      <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-5">
        <h3 className="text-indigo-300 font-semibold text-sm mb-3">League Points scoring</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white font-medium">1 correct pick</p>
            <p className="text-indigo-400 font-bold text-lg mt-1">+1 LP</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white font-medium">6/6 Perfect Week</p>
            <p className="text-yellow-400 font-bold text-lg mt-1">+10 LP</p>
            <p className="text-gray-500 text-[10px]">6 correct + 4 bonus</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white font-medium">Max per Sprint</p>
            <p className="text-green-400 font-bold text-lg mt-1">40 LP</p>
            <p className="text-gray-500 text-[10px]">4 Perfect Weeks</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white font-medium">Sprint duration</p>
            <p className="text-blue-400 font-bold text-lg mt-1">4 GWs</p>
            <p className="text-gray-500 text-[10px]">4 weeks per Sprint</p>
          </div>
        </div>
      </div>

      {usersDiv && (
        <UsersModal divisionId={usersDiv} onClose={() => setUsersDiv(null)} />
      )}
    </div>
  )
}
