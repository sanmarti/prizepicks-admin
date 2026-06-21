import { useState, useEffect, useCallback } from 'react'
import { listDivisions, createDivision, updateDivision, getDivisionUsers } from '../../api/divisions'

// Each division gets an image that escalates in scale and epicness.
// Academy = humble training ground; Champions = packed 100k-seat colosseum.
const DIVISION_VISUALS = {
  1: {
    // Academy — small green training pitch, modest, intimate
    image: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-slate-900/95 via-slate-800/60 to-transparent',
    accent: '#6b7280',
    accentBg: 'rgba(107,114,128,0.15)',
    accentBorder: 'rgba(107,114,128,0.35)',
    label: 'Training Ground',
  },
  2: {
    // Division 4 — small local stadium, lower league atmosphere
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-emerald-950/95 via-emerald-900/55 to-transparent',
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.12)',
    accentBorder: 'rgba(16,185,129,0.30)',
    label: 'Local Stadium',
  },
  3: {
    // Division 3 — professional mid-tier ground, decent crowd
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-blue-950/95 via-blue-900/55 to-transparent',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.12)',
    accentBorder: 'rgba(59,130,246,0.30)',
    label: 'Pro Stadium',
  },
  4: {
    // Division 2 — large professional arena, serious atmosphere
    image: 'https://images.unsplash.com/photo-1540747913346-19212a4b23b4?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-violet-950/95 via-violet-900/55 to-transparent',
    accent: '#8b5cf6',
    accentBg: 'rgba(139,92,246,0.12)',
    accentBorder: 'rgba(139,92,246,0.30)',
    label: 'Elite Arena',
  },
  5: {
    // Division 1 — iconic elite stadium, packed, atmospheric
    image: 'https://images.unsplash.com/photo-1522778526097-ce0a22ceb253?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-amber-950/95 via-amber-900/55 to-transparent',
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.12)',
    accentBorder: 'rgba(245,158,11,0.30)',
    label: 'Premier Ground',
  },
  6: {
    // Champions / Legend — massive, mythical, 100k stadium, night, floodlights
    image: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=900&q=80&auto=format&fit=crop',
    gradient: 'from-red-950/95 via-rose-900/55 to-transparent',
    accent: '#ef4444',
    accentBg: 'rgba(239,68,68,0.12)',
    accentBorder: 'rgba(239,68,68,0.30)',
    label: 'Hall of Legends',
  },
}

function getVisuals(div) {
  return DIVISION_VISUALS[div.display_order] || DIVISION_VISUALS[1]
}

const DEFAULT_FORM = {
  name: '', display_order: '', icon: '🎓',
  color_primary: '#6366f1', color_secondary: '#4f46e5',
  is_initial: false, is_highest: false, allows_relegation: true,
  relegation_max_points: '', retention_min_points: '0',
  retention_max_points: '', promotion_min_points: '',
  is_active: true,
}

// ── Division Card ─────────────────────────────────────────────────────────────
function DivisionCard({ div, onEdit, onViewUsers }) {
  const v = getVisuals(div)
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group bg-[#0d1117] rounded-2xl overflow-hidden border border-white/8 hover:border-white/16 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40">

      {/* Cover image area */}
      <div className="relative h-44 overflow-hidden">
        {!imgError ? (
          <img
            src={v.image}
            alt={div.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          // Fallback gradient field if image fails
          <div
            className="w-full h-full"
            style={{
              background: `radial-gradient(ellipse at center bottom, ${v.accent}30 0%, #0a0d12 70%)`,
            }}
          >
            <svg viewBox="0 0 400 200" className="w-full h-full opacity-20" preserveAspectRatio="xMidYMid slice">
              {/* Simple pitch lines */}
              <rect x="30" y="20" width="340" height="160" rx="4" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="200" cy="100" r="35" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="200" y1="20" x2="200" y2="180" stroke="white" strokeWidth="1" opacity="0.5"/>
              <rect x="30" y="65" width="55" height="70" fill="none" stroke="white" strokeWidth="1.5"/>
              <rect x="315" y="65" width="55" height="70" fill="none" stroke="white" strokeWidth="1.5"/>
              <rect x="30" y="80" width="22" height="40" fill="none" stroke="white" strokeWidth="1.5"/>
              <rect x="348" y="80" width="22" height="40" fill="none" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
        )}

        {/* Gradient overlay — bottom-heavy so the image shows at top */}
        <div className={`absolute inset-0 bg-gradient-to-t ${v.gradient}`}/>

        {/* Subtle vignette on sides */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30"/>

        {/* Order badge top-left */}
        <div className="absolute top-3 left-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border backdrop-blur-sm"
            style={{
              background: v.accentBg,
              borderColor: v.accentBorder,
              color: v.accent,
            }}
          >
            {div.display_order}
          </div>
        </div>

        {/* Status badges top-right */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {div.is_initial && (
            <span className="text-[10px] bg-black/50 backdrop-blur-sm text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-medium">
              STARTER
            </span>
          )}
          {div.is_highest && (
            <span className="text-[10px] bg-black/50 backdrop-blur-sm text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-medium">
              ELITE
            </span>
          )}
          {!div.is_active && (
            <span className="text-[10px] bg-black/50 backdrop-blur-sm text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-medium">
              OFF
            </span>
          )}
        </div>

        {/* Division identity at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border shadow-lg"
            style={{
              background: v.accentBg,
              borderColor: v.accentBorder,
              backdropFilter: 'blur(8px)',
            }}
          >
            {div.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-black text-base leading-tight tracking-tight"
              style={{ color: v.accent, textShadow: `0 0 20px ${v.accent}60` }}
            >
              {div.name}
            </p>
            <p className="text-white/50 text-[11px] mt-0.5 font-medium tracking-wider">{v.label.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">

        {/* Threshold bars */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
            <span>POINTS THRESHOLDS (per sprint)</span>
            <span>0 → 40 LP max</span>
          </div>
          <ThresholdBar div={div} accent={v.accent} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <ThreshCell
            label="Relegation"
            value={div.allows_relegation && div.relegation_max_points !== null
              ? `≤ ${div.relegation_max_points}`
              : '—'}
            color="#ef4444"
            active={div.allows_relegation && div.relegation_max_points !== null}
          />
          <ThreshCell
            label="Retention"
            value={`${div.retention_min_points}–${div.retention_max_points}`}
            color="#6b7280"
            active
          />
          <ThreshCell
            label="Promotion"
            value={div.is_highest ? 'Elite' : `≥ ${div.promotion_min_points}`}
            color="#10b981"
            active={!div.is_highest}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={() => onEdit(div)}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border border-white/8 bg-white/3 hover:bg-white/8 text-gray-300 hover:text-white"
          >
            Edit rules
          </button>
          <button
            onClick={() => onViewUsers(div.id)}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all border text-xs"
            style={{
              background: v.accentBg,
              borderColor: v.accentBorder,
              color: v.accent,
            }}
          >
            View players
          </button>
        </div>
      </div>
    </div>
  )
}

function ThresholdBar({ div, accent }) {
  const MAX = 40
  const relMax = div.allows_relegation && div.relegation_max_points !== null
    ? div.relegation_max_points + 1
    : 0
  const promoMin = div.is_highest ? MAX : div.promotion_min_points
  const retentionWidth = Math.max(0, ((promoMin - relMax) / MAX) * 100)
  const relegationWidth = (relMax / MAX) * 100
  const promotionWidth = Math.max(0, ((MAX - promoMin) / MAX) * 100)

  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
      {relMax > 0 && (
        <div
          className="h-full rounded-l-full"
          style={{ width: `${relegationWidth}%`, background: '#ef444480' }}
          title={`Relegation: 0–${div.relegation_max_points} LP`}
        />
      )}
      <div
        className="h-full"
        style={{
          width: `${retentionWidth}%`,
          background: 'rgba(107,114,128,0.35)',
          flex: retentionWidth === 0 ? undefined : undefined,
        }}
        title={`Retention: ${relMax}–${promoMin - 1} LP`}
      />
      {!div.is_highest && (
        <div
          className="h-full rounded-r-full"
          style={{ width: `${promotionWidth}%`, background: accent + 'aa' }}
          title={`Promotion: ${promoMin}+ LP`}
        />
      )}
    </div>
  )
}

function ThreshCell({ label, value, color, active }) {
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{
        background: active ? color + '12' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? color + '25' : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <p className="text-gray-600 text-[9px] tracking-wider mb-1">{label.toUpperCase()}</p>
      <p className="font-bold text-xs" style={{ color: active ? color : '#4b5563' }}>{value}</p>
    </div>
  )
}

// ── Division Form ─────────────────────────────────────────────────────────────
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
      if (initial?.id) await updateDivision(initial.id, payload)
      else             await createDivision(payload)
      onSave()
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
  const lbl = "text-gray-400 text-xs mb-1.5 block"

  return (
    <form onSubmit={handleSubmit} className="bg-[#0d1117] border border-indigo-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">{initial?.id ? 'Edit Division' : 'New Division'}</h3>
        <button type="button" onClick={onCancel} className="text-gray-600 hover:text-gray-300 text-lg">✕</button>
      </div>

      {err && <p className="text-red-400 text-xs bg-red-900/20 p-3 rounded-xl">{err}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Division name</label>
          <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Division 1" required />
        </div>
        <div>
          <label className={lbl}>Display order (1 = lowest)</label>
          <input className={inp} type="number" value={form.display_order} onChange={e => set('display_order', e.target.value)} placeholder="1" required />
        </div>
        <div>
          <label className={lbl}>Icon (emoji)</label>
          <input className={inp} value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="🎓" />
        </div>
        <div>
          <label className={lbl}>Primary color</label>
          <input className={inp} value={form.color_primary} onChange={e => set('color_primary', e.target.value)} placeholder="#6366f1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Relegation max LP</label>
          <input className={inp} type="number" value={form.relegation_max_points} onChange={e => set('relegation_max_points', e.target.value)} placeholder="9 (blank=none)" />
        </div>
        <div>
          <label className={lbl}>Retention min LP</label>
          <input className={inp} type="number" value={form.retention_min_points} onChange={e => set('retention_min_points', e.target.value)} placeholder="10" required />
        </div>
        <div>
          <label className={lbl}>Retention max LP</label>
          <input className={inp} type="number" value={form.retention_max_points} onChange={e => set('retention_max_points', e.target.value)} placeholder="16" required />
        </div>
        <div>
          <label className={lbl}>Promotion min LP</label>
          <input className={inp} type="number" value={form.promotion_min_points} onChange={e => set('promotion_min_points', e.target.value)} placeholder="17" required />
        </div>
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        {[['allows_relegation','Allow relegation'],['is_initial','Starter division'],['is_highest','Highest division'],['is_active','Active']].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500" />
            {label}
          </label>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-sm transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Players Modal ─────────────────────────────────────────────────────────────
function UsersModal({ divisionId, divisions, onClose }) {
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const div = divisions.find(d => d.id === divisionId)
  const v = div ? getVisuals(div) : DIVISION_VISUALS[1]

  useEffect(() => {
    getDivisionUsers(divisionId)
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [divisionId])

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header with division colour */}
        <div
          className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor: v.accentBorder, background: v.accentBg }}
        >
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
              className="flex items-center justify-between rounded-xl px-3 py-2.5 border border-white/5 bg-white/3 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-900/50 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                  {(u.display_name || u.email)?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm">{u.display_name || u.email?.split('@')[0]}</p>
                  <p className="text-gray-600 text-xs">{u.email}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                {u.current_sprint_lp !== null && u.current_sprint_lp !== undefined && (
                  <span className="text-sm font-bold" style={{ color: v.accent }}>
                    {u.current_sprint_lp} LP
                  </span>
                )}
                {u.is_rookie && (
                  <span className="text-[10px] bg-yellow-900/30 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">
                    Rookie
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DivisionsPage() {
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [usersDiv, setUsersDiv]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    listDivisions()
      .then(r => setDivisions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaved = () => { setShowForm(false); setEditTarget(null); load() }

  const handleEdit = (div) => {
    setEditTarget({
      ...div,
      relegation_max_points: div.relegation_max_points ?? '',
      retention_min_points:  div.retention_min_points ?? 0,
      retention_max_points:  div.retention_max_points ?? '',
      promotion_min_points:  div.promotion_min_points ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Divisions</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            6 competitive tiers — from humble training grounds to legendary arenas
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          + New division
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <DivisionForm
          initial={editTarget}
          onSave={handleSaved}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-44 bg-white/5"/>
              <div className="p-4 space-y-3">
                <div className="h-2 bg-white/5 rounded-full w-3/4"/>
                <div className="h-2 bg-white/5 rounded-full w-1/2"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Division cards grid */}
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

      {/* Scoring reference */}
      <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-5">
        <p className="text-gray-400 text-xs font-medium tracking-wider mb-3">LEAGUE POINTS REFERENCE</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '1 correct pick',   value: '+1 LP',  color: '#6366f1', note: 'per pick' },
            { label: '6/6 Perfect Week', value: '+10 LP', color: '#f59e0b', note: '6 correct + 4 bonus' },
            { label: 'Max per gameweek', value: '10 LP',  color: '#10b981', note: '4 perfect weeks = 40' },
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

      {/* Players modal */}
      {usersDiv && (
        <UsersModal
          divisionId={usersDiv}
          divisions={divisions}
          onClose={() => setUsersDiv(null)}
        />
      )}
    </div>
  )
}
