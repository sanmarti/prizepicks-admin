import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { browseCompetitions, importCompetition, deleteCompetition } from '../../api/competitions'
import { useToast } from '../../hooks/useToast'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const SEASONS = ['2026', '2025', '2024', '2023', '2022']

const TYPE_STYLE = {
  League:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Cup:        'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  Tournament: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

function TypeBadge({ type }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_STYLE[type] ?? TYPE_STYLE.League}`}>
      {type}
    </span>
  )
}

function ImportedEntry({ entry, onView, onDelete }) {
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  return (
    <div className="flex items-center justify-between bg-green-900/10 border border-green-500/20 rounded-xl px-3 py-2 mt-2">
      <div className="text-xs text-green-400">
        <span className="font-semibold">Season {entry.api_season}</span>
        <span className="text-green-600 ml-2">{entry.fixture_count} fixtures</span>
        {entry.last_synced && (
          <span className="text-green-700 ml-2">· last sync {fmtDate(entry.last_synced)}</span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onView(entry.id)}
          className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-0.5 rounded border border-indigo-500/20 hover:border-indigo-500/40"
        >
          View
        </button>
        <button
          onClick={() => onDelete(entry)}
          className="text-[11px] text-red-400 hover:text-red-300 transition-colors px-2 py-0.5 rounded border border-red-500/20 hover:border-red-500/40"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

function CompetitionCard({ comp, onImported, onDeleteEntry, onView }) {
  const [season, setSeason]   = useState(String(comp.default_season))
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')

  const alreadyImported = comp.imported.some(e => e.api_season === season)

  const handleImport = async () => {
    setLoading(true); setMsg(''); setErr('')
    try {
      const res = await importCompetition({ api_league_id: comp.api_league_id, season })
      setMsg(res.data.message)
      onImported()
      setTimeout(() => setMsg(''), 6000)
    } catch (e) {
      setErr(e.response?.data?.message || e.response?.data?.error || 'Import failed')
      setTimeout(() => setErr(''), 6000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden flex flex-col hover:border-white/15 transition-colors">
      {/* Header with logo */}
      <div className="relative h-20 bg-gradient-to-br from-indigo-950/60 via-[#0d1117] to-[#111520] overflow-hidden">
        <img
          src={comp.logo_url}
          alt=""
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 object-contain opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#111520]" />
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 flex items-center gap-2">
          <img
            src={comp.logo_url}
            alt={comp.name}
            className="w-8 h-8 object-contain flex-shrink-0"
            onError={e => { e.target.style.display = 'none' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{comp.name}</p>
            <p className="text-gray-500 text-[11px]">{comp.flag} {comp.country}</p>
          </div>
          <TypeBadge type={comp.type} />
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        {/* Imported entries */}
        {comp.imported.length > 0 && comp.imported.map(entry => (
          <ImportedEntry
            key={entry.id}
            entry={entry}
            onView={onView}
            onDelete={onDeleteEntry}
          />
        ))}

        {/* Import row */}
        <div className="flex gap-2 mt-auto pt-1">
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            {SEASONS.map(s => (
              <option key={s} value={s}>{s}/{(parseInt(s)+1).toString().slice(-2)}</option>
            ))}
          </select>
          <button
            onClick={handleImport}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${
              alreadyImported
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white'
                : 'bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-500/30'
            }`}
          >
            {loading
              ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Importing…</>
              : alreadyImported ? '↻ Re-sync' : '↓ Import'
            }
          </button>
        </div>

        {msg && <p className="text-green-400 text-[11px] leading-tight">{msg}</p>}
        {err && <p className="text-red-400 text-[11px] leading-tight">{err}</p>}
      </div>
    </div>
  )
}

export default function CompetitionsPage() {
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  const [competitions, setCompetitions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filter, setFilter]             = useState('all')

  const load = () => {
    setLoading(true)
    browseCompetitions()
      .then(r => setCompetitions(r.data))
      .catch(() => toast('Failed to load competitions', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleDelete() {
    try {
      await deleteCompetition(deleteTarget.id)
      toast(`Season ${deleteTarget.api_season} removed`)
      setDeleteTarget(null)
      load()
    } catch {
      toast('Delete failed', 'error')
    }
  }

  const filtered = competitions.filter(c => {
    if (filter === 'imported') return c.imported.length > 0
    if (filter === 'not-imported') return c.imported.length === 0
    return true
  })

  const importedCount = competitions.filter(c => c.imported.length > 0).length

  return (
    <>
      <ToastContainer toasts={toasts} />
      <ConfirmModal
        open={!!deleteTarget}
        danger
        title={`Remove season ${deleteTarget?.api_season}?`}
        message="This will delete the competition record and all its cached fixtures and standings. Gameweek events that reference these fixtures will lose their competition link."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-green-400 font-bold text-lg">{importedCount}</span>
                <span className="text-gray-500 text-sm">Imported</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-bold text-lg">{competitions.length - importedCount}</span>
                <span className="text-gray-500 text-sm">Available</span>
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-1">
              Select a competition, choose a season, and click Import — fixtures and standings are cached in your DB.
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 flex-shrink-0">
            {[
              { key: 'all', label: 'All' },
              { key: 'imported', label: '✓ Imported' },
              { key: 'not-imported', label: 'Not imported' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  filter === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading competitions…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(comp => (
              <CompetitionCard
                key={comp.api_league_id}
                comp={comp}
                onImported={load}
                onDeleteEntry={setDeleteTarget}
                onView={id => navigate(`/admin/competitions/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
