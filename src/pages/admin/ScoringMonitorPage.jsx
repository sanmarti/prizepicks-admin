import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getGameweeks, getGameweek } from '../../api/gameweeks'
import { resolveGameweek, overridePick } from '../../api/scoring'
import { useToast } from '../../hooks/useToast'
import StatusBadge from '../../components/admin/ui/StatusBadge'
import ActionButton from '../../components/admin/ui/ActionButton'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

export default function ScoringMonitorPage() {
  const { data: gameweeks } = useApi(getGameweeks)
  const { toasts, toast } = useToast()

  const [selectedId, setSelectedId]     = useState('')
  const [confirmResolve, setConfirmResolve] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState(null)
  const [overrideResult, setOverrideResult] = useState('WON')
  const [overrideReason, setOverrideReason] = useState('')
  const [loading, setLoading]           = useState(false)

  const { data: gw, refetch } = useApi(
    () => selectedId ? getGameweek(selectedId) : Promise.resolve({ data: null }),
    [selectedId]
  )

  async function handleResolve() {
    setConfirmResolve(false); setLoading(true)
    try {
      await resolveGameweek(selectedId)
      toast('Gameweek resolved! Standings updated.', 'success')
      refetch()
    } catch (e) {
      toast(e.response?.data?.error ?? 'Resolve failed', 'error')
    } finally { setLoading(false) }
  }

  async function handleOverride() {
    setLoading(true)
    try {
      await overridePick(overrideTarget.id, overrideResult, overrideReason)
      toast(`Pick overridden → ${overrideResult}`)
      setOverrideTarget(null)
      refetch()
    } catch { toast('Override failed', 'error') }
    finally { setLoading(false) }
  }

  const publishedGws = (gameweeks ?? []).filter((g) => ['PUBLISHED', 'LOCKED', 'FINISHED'].includes(g.status))

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <ConfirmModal
        open={confirmResolve}
        title="Resolve Gameweek?"
        message="This will call API-Football for final results, update all picks, resolve matchups, and update standings. This cannot be undone."
        confirmLabel="🔄 Resolve All"
        onConfirm={handleResolve}
        onCancel={() => setConfirmResolve(false)}
      />

      {/* Override modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1c2333] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-white font-semibold">Override Pick</h3>
            <p className="text-gray-400 text-sm">{overrideTarget.label}</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Result</label>
              <select value={overrideResult} onChange={(e) => setOverrideResult(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="WON">WON</option>
                <option value="LOST">LOST</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Reason</label>
              <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="API error, manual verification…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"/>
            </div>
            <div className="flex gap-3 justify-end">
              <ActionButton variant="secondary" onClick={() => setOverrideTarget(null)}>Cancel</ActionButton>
              <ActionButton onClick={handleOverride} loading={loading}>Apply Override</ActionButton>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Gameweek selector + resolve button */}
        <div className="flex items-center gap-4">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="">Select a gameweek…</option>
            {publishedGws.map((g) => (
              <option key={g.id} value={g.id}>
                Week {g.week_number} — {g.status} ({g.league_name ?? g.competition})
              </option>
            ))}
          </select>
          {selectedId && gw?.status !== 'FINISHED' && (
            <ActionButton onClick={() => setConfirmResolve(true)} loading={loading}>
              🔄 Resolve Gameweek
            </ActionButton>
          )}
        </div>

        {/* Events table */}
        {gw && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold">Week {gw.week_number}</h2>
              <StatusBadge status={gw.status}/>
              <span className="text-gray-500 text-sm">
                Lock: {gw.lock_time ? new Date(gw.lock_time).toLocaleString() : '—'}
              </span>
            </div>

            {(gw.events ?? []).map((ev) => (
              <div key={ev.id} className="bg-[#111520] border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-white/3 border-b border-white/8 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{ev.fixture_name}</p>
                    <p className="text-gray-400 text-xs">{ev.event_type?.replace('_', ' ')}</p>
                  </div>
                  <StatusBadge status={ev.status}/>
                </div>
                <div className="divide-y divide-white/5">
                  {(ev.options ?? []).map((opt) => (
                    <div key={opt.id} className="px-5 py-3 flex items-center gap-4">
                      <span className="flex-1 text-gray-200 text-sm">{opt.label}</span>
                      <span className="text-indigo-400 text-xs">⚡ {opt.energy_cost}</span>
                      <StatusBadge status={opt.result}/>
                      <ActionButton size="sm" variant="ghost" onClick={() => setOverrideTarget(opt)}>
                        ✏️
                      </ActionButton>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!selectedId && (
          <div className="text-center py-20 text-gray-500">Select a gameweek to monitor scoring</div>
        )}
      </div>
    </>
  )
}
