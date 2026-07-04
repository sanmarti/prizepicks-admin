import { useState, useEffect } from 'react'
import { listDivisions, createDivision, updateDivision } from '../../api/divisions'
import { getRankings } from '../../api/sprints'
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
function DivisionCard({ div, isEditing, onEdit, onSave, onCancel, saving, onViewRankings }) {
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
        {/* Player count */}
        <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl"
          style={{ background: v.accentBg, border: `1px solid ${v.accentBorder}` }}>
          <span className="text-[10px] text-gray-500 font-medium tracking-wider flex-1">CURRENT PLAYERS</span>
          <span className="font-black text-sm" style={{ color: v.accent }}>
            {div.player_count ?? 0}
          </span>
        </div>

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
            onClick={() => onViewRankings(div.id)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
            style={{ background: v.accentBg, borderColor: v.accentBorder, color: v.accent }}>
            Rankings →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Full-screen division rankings panel ───────────────────────────────────────
function DivisionRankingsPanel({ divisionId, divisions, onClose }) {
  const [rows, setRows]     = useState([])
  const [sprint, setSprint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)

  const div = divisions.find(d => d.id === divisionId)
  const v   = div ? getVisuals(div) : DIVISION_VISUALS[1]

  const promLP = div?.promotion_min_points ?? null
  const relLP  = div?.allows_relegation && div?.relegation_max_points !== null ? div.relegation_max_points : null

  useEffect(() => {
    getRankings({ division_id: divisionId })
      .then(r => { setRows(r.data.rows || []); setSprint(r.data.sprint) })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [divisionId])

  // First index in relegation zone
  const firstRelIdx  = relLP  !== null ? rows.findIndex(r => r.total_league_points <= relLP) : -1
  // Last index in promotion zone
  const lastPromoIdx = promLP !== null ? rows.filter(r => r.total_league_points >= promLP).length - 1 : -1

  const coverSrc = div?.badge_url || v.image

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0d12]">
      {/* Hero */}
      <div className="relative h-40 flex-shrink-0 overflow-hidden">
        {!imgError
          ? <img src={coverSrc} alt={div?.name} onError={() => setImgError(true)} className="w-full h-full object-cover opacity-70" />
          : <div className={`w-full h-full bg-gradient-to-br ${v.gradient}`} />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d12] via-[#0a0d12]/50 to-transparent" />

        <button onClick={onClose}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-gray-300 hover:text-white bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 transition-colors">
          ← Back
        </button>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl border"
            style={{ background: v.accentBg, borderColor: v.accentBorder }}>
            {div?.icon}
          </div>
          <div>
            <p className="font-black text-lg leading-tight" style={{ color: v.accent }}>{div?.name}</p>
            <p className="text-white/40 text-[10px] tracking-wider">
              {sprint ? `${sprint.name} · ` : ''}Rankings
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-white font-bold text-sm">{rows.length}</p>
            <p className="text-gray-600 text-[10px]">players</p>
          </div>
        </div>
      </div>

      {/* Zone legend */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/8 flex-shrink-0 bg-[#0d1117]">
        {promLP !== null && !div?.is_highest && (
          <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded bg-green-500/25 border border-green-500/40 inline-block" />
            Promotion ≥{promLP} LP
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold">
          <span className="w-2.5 h-2.5 rounded bg-white/5 border border-white/10 inline-block" />
          Retention
        </span>
        {relLP !== null && (
          <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-semibold ml-auto">
            <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500/30 inline-block" />
            Relegation ≤{relLP} LP
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-white/5 flex-shrink-0 bg-[#0d1117]">
        <span className="w-7 text-[10px] text-gray-600 text-center">#</span>
        <span className="flex-1 text-[10px] text-gray-600">Player</span>
        <span className="w-10 text-[10px] text-gray-600 text-right">LP</span>
        <span className="w-10 text-[10px] text-gray-600 text-right">✓</span>
        <span className="w-8 text-[10px] text-gray-600 text-right">⭐</span>
        <span className="w-8 text-[10px] text-gray-600 text-right">GW</span>
        <span className="w-16 text-[10px] text-gray-600 text-center">Status</span>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-600 text-sm">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: v.accent, borderTopColor: 'transparent' }} />
            Loading…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span className="text-6xl">🏟️</span>
            <p className="text-gray-300 text-sm font-semibold">No players have reached this level yet</p>
            <p className="text-gray-600 text-xs">The stadium is empty… for now. Someone's got to be first! 👀</p>
          </div>
        )}

        {!loading && rows.map((row, i) => {
          const rank    = i + 1
          const isPromo = promLP !== null && row.total_league_points >= promLP
          const isRel   = relLP  !== null && row.total_league_points <= relLP
          const showRelDivider = firstRelIdx === i && i > 0

          return (
            <div key={row.user_id}>
              {showRelDivider && (
                <div className="flex items-center gap-2 px-5 py-2 bg-red-950/25 border-y border-red-500/20">
                  <span className="text-red-400 text-[10px] font-bold tracking-wider">⬇ RELEGATION ZONE — ≤{relLP} LP</span>
                </div>
              )}

              <div className={`flex items-center gap-3 px-5 py-3 border-b border-white/4 transition-colors ${
                isPromo ? 'bg-green-950/15 hover:bg-green-950/25' :
                isRel   ? 'bg-red-950/12 hover:bg-red-950/20' :
                'hover:bg-white/2'
              }`}>
                {/* Rank */}
                <span className={`w-7 text-center text-sm font-black flex-shrink-0 ${
                  rank === 1 ? 'text-yellow-400' :
                  rank === 2 ? 'text-gray-300' :
                  rank === 3 ? 'text-amber-600' : 'text-gray-700'
                }`}>{rank}</span>

                {/* Avatar + name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border"
                    style={{ background: v.accentBg, borderColor: v.accentBorder, color: v.accent }}>
                    {(row.display_name || row.email)?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate leading-tight">{row.display_name || row.email?.split('@')[0]}</p>
                    <p className="text-gray-700 text-[10px] truncate">{row.email}</p>
                  </div>
                </div>

                {/* LP */}
                <span className={`w-10 text-right font-black text-sm flex-shrink-0 ${
                  isPromo ? 'text-green-400' : isRel ? 'text-red-400' : 'text-indigo-400'
                }`}>{row.total_league_points}</span>

                {/* Correct */}
                <span className="w-10 text-right text-gray-300 text-sm flex-shrink-0">{row.total_correct_picks}</span>

                {/* Perfect weeks */}
                <span className="w-8 text-right text-yellow-400 text-sm flex-shrink-0">
                  {row.perfect_weeks > 0 ? row.perfect_weeks : <span className="text-gray-700">—</span>}
                </span>

                {/* GW participated */}
                <span className="w-8 text-right text-gray-500 text-sm flex-shrink-0">{row.gameweeks_participated}</span>

                {/* Outcome / Zone badge */}
                <div className="w-16 flex justify-center flex-shrink-0">
                  {isPromo && !div?.is_highest ? (
                    <span className="text-[10px] bg-green-900/30 text-green-400 border border-green-500/25 px-1.5 py-0.5 rounded-full font-semibold">⬆ Up</span>
                  ) : isRel ? (
                    <span className="text-[10px] bg-red-900/25 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-semibold">⬇ Down</span>
                  ) : row.is_rookie ? (
                    <span className="text-[10px] bg-yellow-900/25 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">Rookie</span>
                  ) : (
                    <span className="text-[10px] text-gray-700">—</span>
                  )}
                </div>
              </div>

              {/* Promotion divider */}
              {lastPromoIdx === i && i < rows.length - 1 && !div?.is_highest && (
                <div className="flex items-center gap-2 px-5 py-1.5 bg-white/2 border-b border-white/8">
                  <span className="text-gray-600 text-[10px] font-semibold tracking-wider">— RETENTION ZONE —</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer summary */}
      {!loading && rows.length > 0 && (
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/8 bg-[#0d1117] grid grid-cols-3 gap-3 text-center">
          {[
            ['Promotion', rows.filter(r => promLP !== null && r.total_league_points >= promLP).length, '#22c55e'],
            ['Retention', rows.filter(r => {
              const inPromo = promLP !== null && r.total_league_points >= promLP
              const inRel   = relLP  !== null && r.total_league_points <= relLP
              return !inPromo && !inRel
            }).length, '#6b7280'],
            ['Relegation', rows.filter(r => relLP !== null && r.total_league_points <= relLP).length, '#ef4444'],
          ].map(([label, count, color]) => (
            <div key={label}>
              <p className="font-black text-lg" style={{ color }}>{count}</p>
              <p className="text-gray-600 text-[10px]">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DivisionsPage() {
  const { data: divisions, loading, refetch } = useApi(listDivisions)
  const { toasts, toast }   = useToast()
  const [editingId, setEditingId]     = useState(null)
  const [showCreate, setShowCreate]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [rankingsDiv, setRankingsDiv] = useState(null)

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

      {rankingsDiv && (
        <DivisionRankingsPanel divisionId={rankingsDiv} divisions={sorted} onClose={() => setRankingsDiv(null)} />
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
                onViewRankings={setRankingsDiv}
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
