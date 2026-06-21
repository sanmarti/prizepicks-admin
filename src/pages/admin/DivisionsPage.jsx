import { useState, useEffect } from 'react'
import { listDivisions, createDivision, updateDivision, getDivisionUsers } from '../../api/divisions'
import { useApi } from '../../hooks/useApi'
import { useToast } from '../../hooks/useToast'
import ActionButton from '../../components/admin/ui/ActionButton'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const DIVISION_VISUALS = {
  1: {
    // Academy — modest youth training pitch, humble academy field
    image: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-slate-900 via-slate-800 to-slate-950',
    accent: '#6b7280',
    accentBg: 'rgba(107,114,128,0.15)',
    accentBorder: 'rgba(107,114,128,0.35)',
    label: 'Academy Pitch',
  },
  2: {
    // Division 4 — small local ground, wooden stands, intimate
    image: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-orange-950 via-orange-900 to-slate-950',
    accent: '#f97316',
    accentBg: 'rgba(249,115,22,0.12)',
    accentBorder: 'rgba(249,115,22,0.30)',
    label: 'Local Ground',
  },
  3: {
    // Division 3 — modest regional stadium, concrete terrace, a few thousand seats
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-blue-950 via-blue-900 to-slate-950',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.12)',
    accentBorder: 'rgba(59,130,246,0.30)',
    label: 'Regional Stadium',
  },
  4: {
    // Division 2 — professional stadium, proper floodlights, decent crowd
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-green-950 via-green-900 to-slate-950',
    accent: '#22c55e',
    accentBg: 'rgba(34,197,94,0.12)',
    accentBorder: 'rgba(34,197,94,0.30)',
    label: 'Pro Stadium',
  },
  5: {
    // Division 1 — large top-flight stadium, packed stands
    image: 'https://images.unsplash.com/photo-1540747913346-19212a4b23b4?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-amber-950 via-amber-900 to-slate-950',
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.12)',
    accentBorder: 'rgba(245,158,11,0.30)',
    label: 'Premier Ground',
  },
  6: {
    // Champions / Legend — iconic Champions League arena, massive night atmosphere
    image: 'https://images.unsplash.com/photo-1522778526097-ce0a22ceb253?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-purple-950 via-purple-900 to-slate-950',
    accent: '#a855f7',
    accentBg: 'rgba(168,85,247,0.12)',
    accentBorder: 'rgba(168,85,247,0.30)',
    label: 'Hall of Legends',
  },
}

function getVisuals(div) {
  return DIVISION_VISUALS[div.display_order] || DIVISION_VISUALS[1]
}

const toInt = (v) => {
  if (v === '' || v == null) return null
  const n = parseInt(v)
  return isNaN(n) ? null : n
}

// ── Threshold bar ─────────────────────────────────────────────────────────────
function ThresholdBar({ div, accent }) {
  const MAX = 40
  const relMax   = div.allows_relegation && div.relegation_max_points !== null ? div.relegation_max_points + 1 : 0
  const promoMin = div.is_highest ? MAX : (div.promotion_min_points ?? MAX)
  const relegW   = (relMax / MAX) * 100
  const retW     = Math.max(0, ((promoMin - relMax) / MAX) * 100)
  const promoW   = Math.max(0, ((MAX - promoMin) / MAX) * 100)

  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
      {relMax > 0 && <div className="h-full rounded-l-full" style={{ width: `${relegW}%`, background: '#ef444480' }} />}
      <div className="h-full" style={{ width: `${retW}%`, background: 'rgba(107,114,128,0.35)' }} />
      {!div.is_highest && <div className="h-full rounded-r-full" style={{ width: `${promoW}%`, background: accent + 'aa' }} />}
    </div>
  )
}

function ThreshCell({ label, value, color, active }) {
  return (
    <div className="rounded-xl p-2.5 text-center"
      style={{
        background: active ? color + '12' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? color + '25' : 'rgba(255,255,255,0.05)'}`,
      }}>
      <p className="text-gray-600 text-[9px] tracking-wider mb-1">{label.toUpperCase()}</p>
      <p className="font-bold text-xs" style={{ color: active ? color : '#4b5563' }}>{value}</p>
    </div>
  )
}

// ── Inline edit form (rendered inside the card) ───────────────────────────────
function DivisionInlineForm({ div, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name:                 div.name ?? '',
    display_order:        div.display_order ?? '',
    icon:                 div.icon ?? '🎓',
    badge_url:            div.badge_url ?? '',
    color_primary:        div.color_primary ?? '#6366f1',
    color_secondary:      div.color_secondary ?? '#4f46e5',
    is_initial:           div.is_initial ?? false,
    is_highest:           div.is_highest ?? false,
    allows_relegation:    div.allows_relegation ?? true,
    relegation_max_points: div.relegation_max_points ?? '',
    retention_min_points:  div.retention_min_points ?? 0,
    retention_max_points:  div.retention_max_points ?? '',
    promotion_min_points:  div.promotion_min_points ?? '',
    is_active:             div.is_active ?? true,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
  const lbl = "text-gray-400 text-xs mb-1.5 block"

  const handleSave = () => {
    const payload = {
      ...form,
      badge_url:             form.badge_url || null,
      display_order:         parseInt(form.display_order),
      relegation_max_points: toInt(form.relegation_max_points),
      retention_min_points:  toInt(form.retention_min_points) ?? 0,
      retention_max_points:  toInt(form.retention_max_points),
      promotion_min_points:  form.is_highest ? null : toInt(form.promotion_min_points),
    }
    onSave(payload)
  }

  const isValid = form.name && form.display_order

  return (
    <div className="space-y-4">
      {/* Identity row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={lbl}>Division name</label>
          <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Academy" required />
        </div>
        <div>
          <label className={lbl}>Icon</label>
          <input className={inp} value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🎓" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Display order (1 = lowest)</label>
          <input className={inp} type="number" value={form.display_order} onChange={e => set('display_order', e.target.value)} placeholder="1" />
        </div>
        <div>
          <label className={lbl}>Primary color</label>
          <div className="flex gap-2">
            <input className={`${inp} flex-1`} value={form.color_primary} onChange={e => set('color_primary', e.target.value)} placeholder="#6366f1" />
            <input type="color" value={form.color_primary} onChange={e => set('color_primary', e.target.value)}
              className="w-10 h-9 rounded-xl border-0 bg-transparent cursor-pointer flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Custom image */}
      <div>
        <label className={lbl}>Custom image URL <span className="text-gray-600">(optional — overrides default photo)</span></label>
        <input className={inp} value={form.badge_url} onChange={e => set('badge_url', e.target.value)}
          placeholder="https://images.unsplash.com/photo-…" />
        {form.badge_url && (
          <div className="mt-2 h-16 rounded-xl overflow-hidden border border-white/10">
            <img src={form.badge_url} alt="preview" className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none' }} />
          </div>
        )}
      </div>

      {/* LP thresholds */}
      <div>
        <p className="text-gray-600 text-[10px] tracking-wider mb-2">LEAGUE POINT THRESHOLDS</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Relegation max LP <span className="text-gray-600">(blank = no relegation)</span></label>
            <input className={inp} type="number" value={form.relegation_max_points}
              onChange={e => set('relegation_max_points', e.target.value)}
              placeholder="e.g. 9" disabled={!form.allows_relegation} />
          </div>
          <div>
            <label className={lbl}>Retention min LP</label>
            <input className={inp} type="number" value={form.retention_min_points}
              onChange={e => set('retention_min_points', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className={lbl}>Retention max LP</label>
            <input className={inp} type="number" value={form.retention_max_points}
              onChange={e => set('retention_max_points', e.target.value)} placeholder="e.g. 16" />
          </div>
          <div>
            <label className={lbl}>
              Promotion min LP
              {form.is_highest && <span className="text-gray-600 ml-1">(top division — n/a)</span>}
            </label>
            <input className={inp} type="number" value={form.promotion_min_points}
              onChange={e => set('promotion_min_points', e.target.value)}
              placeholder={form.is_highest ? 'n/a' : 'e.g. 17'}
              disabled={form.is_highest} />
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {[
          ['allows_relegation', 'Allow relegation'],
          ['is_initial',        'Starter division'],
          ['is_highest',        'Top division (no promotion)'],
          ['is_active',         'Active'],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500" />
            {label}
          </label>
        ))}
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <ActionButton variant="secondary" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton onClick={handleSave} loading={saving} disabled={!isValid || saving}>
          Save changes
        </ActionButton>
      </div>
    </div>
  )
}

// ── Division card — view mode & edit mode ─────────────────────────────────────
function DivisionCard({ div, isEditing, onEdit, onSave, onCancel, saving, onViewUsers }) {
  const v = getVisuals(div)
  const [imgError, setImgError] = useState(false)
  const coverSrc = div.badge_url || v.image

  if (isEditing) {
    return (
      <div className="bg-[#0d1117] border border-indigo-500/30 rounded-2xl overflow-hidden">
        {/* Mini cover header — same image, reduced height */}
        <div className={`relative h-20 bg-gradient-to-br ${v.gradient} overflow-hidden`}>
          {!imgError ? (
            <img src={coverSrc} alt={div.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-center opacity-40" />
          ) : (
            <div className="w-full h-full" style={{ background: `radial-gradient(ellipse at center, ${v.accent}20 0%, transparent 70%)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-2.5 flex items-end gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: v.accentBg, border: `1px solid ${v.accentBorder}` }}>
              {div.icon}
            </div>
            <p className="font-bold text-sm leading-tight" style={{ color: v.accent }}>{div.name}</p>
          </div>
        </div>

        {/* Inline form */}
        <div className="px-4 py-4">
          <DivisionInlineForm
            div={div}
            onSave={onSave}
            onCancel={onCancel}
            saving={saving}
          />
        </div>
      </div>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────────
  return (
    <div className="group bg-[#0d1117] rounded-2xl overflow-hidden border border-white/8 hover:border-white/16 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40">

      {/* Cover image area */}
      <div className="relative h-44 overflow-hidden">
        {!imgError ? (
          <img src={coverSrc} alt={div.name} onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full"
            style={{ background: `radial-gradient(ellipse at center bottom, ${v.accent}30 0%, #0a0d12 70%)` }}>
            <svg viewBox="0 0 400 200" className="w-full h-full opacity-20" preserveAspectRatio="xMidYMid slice">
              <rect x="30" y="20" width="340" height="160" rx="4" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="200" cy="100" r="35" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="200" y1="20" x2="200" y2="180" stroke="white" strokeWidth="1" opacity="0.5"/>
              <rect x="30" y="65" width="55" height="70" fill="none" stroke="white" strokeWidth="1.5"/>
              <rect x="315" y="65" width="55" height="70" fill="none" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t from-[#0d1117]/95 via-[#0d1117]/40 to-transparent`} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />

        {/* Order badge */}
        <div className="absolute top-3 left-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border backdrop-blur-sm"
            style={{ background: v.accentBg, borderColor: v.accentBorder, color: v.accent }}>
            {div.display_order}
          </div>
        </div>

        {/* Status chips */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {div.is_initial && <span className="text-[10px] bg-black/50 backdrop-blur-sm text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-medium">STARTER</span>}
          {div.is_highest && <span className="text-[10px] bg-black/50 backdrop-blur-sm text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-medium">TOP</span>}
          {!div.is_active  && <span className="text-[10px] bg-black/50 backdrop-blur-sm text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-medium">OFF</span>}
        </div>

        {/* Division identity */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border shadow-lg"
            style={{ background: v.accentBg, borderColor: v.accentBorder, backdropFilter: 'blur(8px)' }}>
            {div.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-base leading-tight" style={{ color: v.accent, textShadow: `0 0 20px ${v.accent}60` }}>
              {div.name}
            </p>
            <p className="text-white/50 text-[11px] mt-0.5 font-medium tracking-wider">{v.label.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
            <span>POINTS THRESHOLDS (per sprint)</span>
            <span>0 → 40 LP</span>
          </div>
          <ThresholdBar div={div} accent={v.accent} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ThreshCell label="Relegation"
            value={div.allows_relegation && div.relegation_max_points !== null ? `≤ ${div.relegation_max_points}` : '—'}
            color="#ef4444" active={div.allows_relegation && div.relegation_max_points !== null} />
          <ThreshCell label="Retention"
            value={`${div.retention_min_points}–${div.retention_max_points}`}
            color="#6b7280" active />
          <ThreshCell label="Promotion"
            value={div.is_highest ? 'Top' : `≥ ${div.promotion_min_points}`}
            color="#10b981" active={!div.is_highest} />
        </div>

        <div className="flex gap-2 pt-0.5" onClick={e => e.stopPropagation()}>
          <ActionButton size="sm" variant="secondary" onClick={() => onEdit(div.id)}>
            ✏️ Edit
          </ActionButton>
          <button
            onClick={() => onViewUsers(div.id)}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border text-xs"
            style={{ background: v.accentBg, borderColor: v.accentBorder, color: v.accent }}>
            View players
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Players modal ─────────────────────────────────────────────────────────────
function UsersModal({ divisionId, divisions, onClose }) {
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const div = divisions.find(d => d.id === divisionId)
  const v   = div ? getVisuals(div) : DIVISION_VISUALS[1]

  useEffect(() => {
    getDivisionUsers(divisionId)
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [divisionId])

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor: v.accentBorder, background: v.accentBg }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{div?.icon}</span>
            <div>
              <h3 className="text-white font-bold text-sm">{div?.name}</h3>
              <p className="text-xs" style={{ color: v.accent }}>Players in this division</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-gray-500 text-sm text-center py-10">Loading…</p>}
          {!loading && users.length === 0 && (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">{div?.icon}</p>
              <p className="text-gray-500 text-sm">No players in {div?.name} yet</p>
            </div>
          )}
          {users.map(u => (
            <div key={u.id}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 border border-white/5 bg-white/3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-900/50 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                  {(u.display_name || u.email)?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm">{u.display_name || u.email?.split('@')[0]}</p>
                  <p className="text-gray-600 text-xs">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.current_sprint_lp != null && (
                  <span className="text-sm font-bold" style={{ color: v.accent }}>{u.current_sprint_lp} LP</span>
                )}
                {u.is_rookie && (
                  <span className="text-[10px] bg-yellow-900/30 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">Rookie</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DivisionsPage() {
  const { data: divisions, loading, refetch } = useApi(listDivisions)
  const { toasts, toast }   = useToast()
  const [editingId, setEditingId]   = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [usersDiv, setUsersDiv]     = useState(null)

  async function handleSave(id, payload) {
    setSaving(true)
    try {
      if (id) {
        await updateDivision(id, payload)
        toast(`"${payload.name}" updated`)
        setEditingId(null)
      } else {
        await createDivision(payload)
        toast(`"${payload.name}" created`)
        setShowCreate(false)
      }
      refetch()
    } catch (e) {
      toast(e.response?.data?.message ?? 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...(divisions ?? [])].sort((a, b) => a.display_order - b.display_order)

  return (
    <>
      <ToastContainer toasts={toasts} />

      {usersDiv && (
        <UsersModal divisionId={usersDiv} divisions={sorted} onClose={() => setUsersDiv(null)} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold">Divisions</h1>
            <p className="text-gray-500 text-sm mt-0.5">6 competitive tiers — from training grounds to legendary arenas</p>
          </div>
          {!showCreate && (
            <ActionButton onClick={() => { setEditingId(null); setShowCreate(true) }}>
              + New division
            </ActionButton>
          )}
        </div>

        {/* New division inline form */}
        {showCreate && (
          <div className="bg-[#0d1117] border border-indigo-500/30 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">New Division</h2>
            <DivisionInlineForm
              div={{}}
              onSave={(payload) => handleSave(null, payload)}
              onCancel={() => setShowCreate(false)}
              saving={saving}
            />
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 bg-white/5" />
                <div className="p-4 space-y-3">
                  <div className="h-2 bg-white/5 rounded-full w-3/4" />
                  <div className="h-2 bg-white/5 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cards grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map(div => (
              <DivisionCard
                key={div.id}
                div={div}
                isEditing={editingId === div.id}
                onEdit={(id) => { setShowCreate(false); setEditingId(id) }}
                onSave={(payload) => handleSave(div.id, payload)}
                onCancel={() => setEditingId(null)}
                saving={saving}
                onViewUsers={setUsersDiv}
              />
            ))}
          </div>
        )}

        {/* LP reference */}
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5">
          <p className="text-gray-400 text-xs font-medium tracking-wider mb-3">LEAGUE POINTS REFERENCE</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '1 correct pick',   value: '+1 LP',  color: '#6366f1', note: 'per pick' },
              { label: '6/6 Perfect Week', value: '+10 LP', color: '#f59e0b', note: '6 correct + 4 bonus' },
              { label: 'Max per gameweek', value: '10 LP',  color: '#10b981', note: '4 perfect = 40 LP' },
              { label: 'Sprint duration',  value: '4 GWs',  color: '#3b82f6', note: '~4 weeks' },
            ].map(({ label, value, color, note }) => (
              <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                <p className="text-gray-500 text-xs mb-1">{label}</p>
                <p className="font-black text-xl" style={{ color }}>{value}</p>
                <p className="text-gray-700 text-[10px] mt-0.5">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
