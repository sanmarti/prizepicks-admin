import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getCompetitions, createCompetition, updateCompetition, deleteCompetition } from '../../api/competitions'
import { useToast } from '../../hooks/useToast'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import ActionButton from '../../components/admin/ui/ActionButton'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const API_LEAGUES = [
  { id: '39',  name: 'Premier League' },
  { id: '140', name: 'La Liga' },
  { id: '2',   name: 'UEFA Champions League' },
  { id: '135', name: 'Serie A' },
  { id: '61',  name: 'Ligue 1' },
  { id: '78',  name: 'Bundesliga' },
  { id: '1',   name: 'FIFA World Cup' },
  { id: '4',   name: 'UEFA Euro' },
]

const API_SEASONS = ['2022', '2023', '2024', '2025', '2026']

const STATUS_COLORS = {
  FUTURE:      'bg-blue-500/15 text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-green-500/15 text-green-400 border-green-500/20',
  COMPLETED:   'bg-gray-500/15 text-gray-400 border-gray-500/20',
}

const EMPTY_FORM = {
  name: '', description: '', logo_url: '', cover_url: '',
  start_date: '', end_date: '', num_weeks: '',
  api_league_id: '', api_season: '',
}

function CompetitionStatus({ status }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.FUTURE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'IN_PROGRESS' ? 'bg-green-400 animate-pulse' :
        status === 'FUTURE'      ? 'bg-blue-400' : 'bg-gray-400'
      }`}/>
      {status?.replace('_', ' ')}
    </span>
  )
}

function CompetitionCard({ comp, onEdit, onDelete, onCalendar }) {
  const weeks = comp.num_weeks
  const start = new Date(comp.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const end   = new Date(comp.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden group hover:border-white/15 transition-all">
      {/* Cover */}
      <div className="relative h-32 bg-gradient-to-br from-indigo-900/40 to-purple-900/30 overflow-hidden">
        {comp.cover_url ? (
          <img src={comp.cover_url} alt="" className="w-full h-full object-cover opacity-60"/>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20">⚽</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111520] via-transparent to-transparent"/>
        <div className="absolute top-3 right-3">
          <CompetitionStatus status={comp.status}/>
        </div>
        {/* Logo */}
        <div className="absolute bottom-3 left-4 flex items-end gap-3">
          {comp.logo_url ? (
            <img src={comp.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/20"/>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-600/40 border border-indigo-500/30 flex items-center justify-center text-xl">🏆</div>
          )}
          <h3 className="text-white font-bold text-base pb-0.5">{comp.name}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {comp.description && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{comp.description}</p>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white/3 rounded-lg p-2 text-center">
            <p className="text-gray-500 mb-0.5">Weeks</p>
            <p className="text-white font-bold">{weeks}</p>
          </div>
          <div className="bg-white/3 rounded-lg p-2 text-center">
            <p className="text-gray-500 mb-0.5">Start</p>
            <p className="text-white font-medium text-[10px]">{start}</p>
          </div>
          <div className="bg-white/3 rounded-lg p-2 text-center">
            <p className="text-gray-500 mb-0.5">End</p>
            <p className="text-white font-medium text-[10px]">{end}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {comp.api_league_id && comp.api_season && (
            <ActionButton size="sm" variant="secondary" onClick={() => onCalendar(comp)} className="flex-1 justify-center">
              📅 Calendar
            </ActionButton>
          )}
          <ActionButton size="sm" variant="secondary" onClick={() => onEdit(comp)} className={comp.api_league_id && comp.api_season ? '' : 'flex-1 justify-center'}>
            ✏️ Edit
          </ActionButton>
          <ActionButton size="sm" variant="danger" onClick={() => onDelete(comp)}>
            🗑
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function CompetitionForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const isValid = form.name && form.start_date && form.end_date && form.num_weeks

  return (
    <div className="space-y-4">
      {/* Cover preview */}
      {form.cover_url && (
        <div className="h-32 rounded-xl overflow-hidden relative">
          <img src={form.cover_url} alt="" className="w-full h-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Competition Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Premier League 2025/26"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Brief description of the competition…" rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">📅 Start Date *</label>
          <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            style={{ colorScheme: 'dark' }}/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">📅 End Date *</label>
          <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
            min={form.start_date}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            style={{ colorScheme: 'dark' }}/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Number of Weeks *</label>
          <input type="number" min={1} max={52} value={form.num_weeks} onChange={e => set('num_weeks', e.target.value)}
            placeholder="38"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Status</label>
          <div className="px-3 py-2.5 bg-white/3 border border-white/8 rounded-xl">
            <CompetitionStatus status={
              !form.start_date ? 'FUTURE' :
              new Date() < new Date(form.start_date) ? 'FUTURE' :
              new Date() > new Date(form.end_date) ? 'COMPLETED' : 'IN_PROGRESS'
            }/>
            <p className="text-[10px] text-gray-500 mt-1">Auto-computed from dates</p>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Logo URL</label>
          <input value={form.logo_url} onChange={e => set('logo_url', e.target.value)}
            placeholder="https://… (square image)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Cover URL</label>
          <input value={form.cover_url} onChange={e => set('cover_url', e.target.value)}
            placeholder="https://… (wide banner image)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>

        <div className="col-span-2 border-t border-white/8 pt-3">
          <p className="text-xs text-gray-500 mb-3">API-Football mapping — required for the match calendar</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">League</label>
              <select value={form.api_league_id} onChange={e => set('api_league_id', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">— not set —</option>
                {API_LEAGUES.map(l => <option key={l.id} value={l.id}>{l.name} (#{l.id})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Season</label>
              <select value={form.api_season} onChange={e => set('api_season', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">— not set —</option>
                {API_SEASONS.map(s => (
                  <option key={s} value={s}>
                    {s}/{parseInt(s)+1-2000} {parseInt(s) <= 2024 ? '✓ free' : '(paid)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <ActionButton variant="secondary" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton onClick={() => onSave(form)} loading={saving} disabled={!isValid}>
          {initial ? 'Save Changes' : 'Create Competition'}
        </ActionButton>
      </div>
    </div>
  )
}

export default function CompetitionsPage() {
  const navigate = useNavigate()
  const { data: competitions, loading, refetch } = useApi(getCompetitions)
  const { toasts, toast } = useToast()

  const [showForm, setShowForm]       = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving]           = useState(false)

  const statusOrder = { IN_PROGRESS: 0, FUTURE: 1, COMPLETED: 2 }
  const sorted = [...(competitions ?? [])].sort((a, b) =>
    (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
  )

  async function handleSave(form) {
    setSaving(true)
    try {
      if (editTarget) {
        await updateCompetition(editTarget.id, form)
        toast(`"${form.name}" updated`)
      } else {
        await createCompetition(form)
        toast(`"${form.name}" created`)
      }
      setShowForm(false)
      setEditTarget(null)
      refetch()
    } catch (e) {
      toast(e.response?.data?.error ?? 'Save failed', 'error')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    try {
      await deleteCompetition(deleteTarget.id)
      toast(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      refetch()
    } catch { toast('Delete failed', 'error') }
  }

  function handleEdit(comp) {
    setEditTarget(comp)
    setShowForm(true)
  }

  function handleCalendar(comp) {
    navigate(`/admin/competitions/${comp.id}`)
  }

  const counts = {
    IN_PROGRESS: sorted.filter(c => c.status === 'IN_PROGRESS').length,
    FUTURE:      sorted.filter(c => c.status === 'FUTURE').length,
    COMPLETED:   sorted.filter(c => c.status === 'COMPLETED').length,
  }

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <ConfirmModal
        open={!!deleteTarget} danger
        title={`Delete "${deleteTarget?.name}"?`}
        message="This will remove the competition. Leagues linked to it will lose their competition reference."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {[
              { label: 'Live', count: counts.IN_PROGRESS, color: 'text-green-400' },
              { label: 'Upcoming', count: counts.FUTURE, color: 'text-blue-400' },
              { label: 'Completed', count: counts.COMPLETED, color: 'text-gray-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`font-bold text-lg ${color}`}>{count}</span>
                <span className="text-gray-500 text-sm">{label}</span>
              </div>
            ))}
          </div>
          {!showForm && (
            <ActionButton onClick={() => { setEditTarget(null); setShowForm(true) }}>
              + New Competition
            </ActionButton>
          )}
        </div>

        {/* Inline form */}
        {showForm && (
          <div className="bg-[#111520] border border-indigo-500/30 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-lg mb-5">
              {editTarget ? `Edit: ${editTarget.name}` : 'New Competition'}
            </h2>
            <CompetitionForm
              initial={editTarget ? {
                name:          editTarget.name,
                description:   editTarget.description ?? '',
                logo_url:      editTarget.logo_url ?? '',
                cover_url:     editTarget.cover_url ?? '',
                start_date:    editTarget.start_date?.split('T')[0] ?? '',
                end_date:      editTarget.end_date?.split('T')[0] ?? '',
                num_weeks:     editTarget.num_weeks ?? '',
                api_league_id: editTarget.api_league_id ?? '',
                api_season:    editTarget.api_season ?? '',
              } : null}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditTarget(null) }}
              saving={saving}
            />
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading competitions…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">No competitions yet</p>
            <p className="text-gray-600 text-sm">Create your first competition to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(comp => (
              <CompetitionCard
                key={comp.id}
                comp={comp}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
                onCalendar={handleCalendar}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
