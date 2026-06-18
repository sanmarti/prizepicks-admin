import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApi } from '../../hooks/useApi'
import { getLeagues } from '../../api/leagues'
import { createGameweek, publishGameweek } from '../../api/gameweeks'
import { useToast } from '../../hooks/useToast'
import FixtureSelector from '../../components/admin/gameweek/FixtureSelector'
import EventCard from '../../components/admin/gameweek/EventCard'
import EnergyDistribution from '../../components/admin/gameweek/EnergyDistribution'
import ActionButton from '../../components/admin/ui/ActionButton'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const STEPS = ['Basic Info', 'Import Fixtures', 'Review Events', 'Publish']

const DEFAULT_OPTIONS = {
  MATCH_RESULT: [
    { label: 'Home Win', event_type: 'MATCH_RESULT' },
    { label: 'Draw',     event_type: 'MATCH_RESULT' },
    { label: 'Away Win', event_type: 'MATCH_RESULT' },
  ],
  GOALS: [
    { label: 'Over 2.5',  event_type: 'GOALS' },
    { label: 'Under 2.5', event_type: 'GOALS' },
  ],
}

function buildEventsFromFixtures(fixtures) {
  return fixtures.flatMap((f) => [
    {
      id: `${f.id}-mr`,
      fixture_id: f.id,
      fixture_name: `${f.home} vs ${f.away}`,
      event_type: 'MATCH_RESULT',
      match_time: f.date,
      competition: f.competition,
      options: DEFAULT_OPTIONS.MATCH_RESULT.map((o) => ({ ...o, energy_cost: 5, included: true })),
    },
    {
      id: `${f.id}-g`,
      fixture_id: f.id,
      fixture_name: `${f.home} vs ${f.away}`,
      event_type: 'GOALS',
      match_time: f.date,
      competition: f.competition,
      options: DEFAULT_OPTIONS.GOALS.map((o) => ({ ...o, energy_cost: 5, included: true })),
    },
  ])
}

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            i === step ? 'bg-indigo-600 text-white' :
            i < step  ? 'bg-green-600/20 text-green-400' :
                         'bg-white/5 text-gray-500'
          }`}>
            <span>{i < step ? '✓' : i + 1}</span>
            <span>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px mx-1 ${i < step ? 'bg-green-600' : 'bg-white/10'}`}/>
          )}
        </div>
      ))}
    </div>
  )
}

export default function GameweekBuilderPage() {
  const navigate = useNavigate()
  const { data: leagues } = useApi(getLeagues)
  const { toasts, toast } = useToast()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)

  // Step 1 state
  const [leagueId, setLeagueId]     = useState('')
  const [weekNumber, setWeekNumber] = useState('')
  const [lockTime, setLockTime]     = useState('')
  const [revealTime, setRevealTime] = useState('')

  // Step 2 state
  const [selectedFixtures, setSelectedFixtures] = useState([])

  // Step 3 state
  const [events, setEvents] = useState([])

  const activeLeagues = (leagues ?? []).filter((l) => l.status === 'ACTIVE')
  const selectedLeague = activeLeagues.find((l) => l.id === leagueId)

  function handleNext() {
    if (step === 1) setEvents(buildEventsFromFixtures(selectedFixtures))
    setStep((s) => s + 1)
  }

  function handleToggleOption(eventId, optIdx) {
    setEvents((evs) => evs.map((e) =>
      e.id === eventId
        ? { ...e, options: e.options.map((o, i) => i === optIdx ? { ...o, included: !o.included } : o) }
        : e
    ))
  }

  function handleUpdateEnergy(eventId, optIdx, cost) {
    setEvents((evs) => evs.map((e) =>
      e.id === eventId
        ? { ...e, options: e.options.map((o, i) => i === optIdx ? { ...o, energy_cost: cost } : o) }
        : e
    ))
  }

  function buildPayload() {
    return {
      league_id: leagueId,
      week_number: parseInt(weekNumber),
      lock_time: lockTime,
      reveal_time: revealTime || lockTime,
      events: events.map((e) => ({
        event_type: e.event_type,
        fixture_id: String(e.fixture_id),
        fixture_name: e.fixture_name,
        competition: e.competition,
        match_time: e.match_time,
        options: (e.options ?? []).filter((o) => o.included !== false).map((o) => ({
          label: o.label,
          energy_cost: o.energy_cost,
        })),
      })).filter((e) => e.options.length > 0),
    }
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      await createGameweek(buildPayload())
      toast('Gameweek saved as draft')
      navigate('/admin/gameweeks')
    } catch (e) {
      toast(e.response?.data?.error ?? 'Save failed', 'error')
    } finally { setSaving(false) }
  }

  async function handlePublish() {
    setConfirmPublish(false)
    setSaving(true)
    try {
      const { data } = await createGameweek(buildPayload())
      await publishGameweek(data.gameweekId)
      toast(`Week ${weekNumber} published! Matchups assigned.`, 'success')
      navigate('/admin/scoring')
    } catch (e) {
      toast(e.response?.data?.error ?? 'Publish failed', 'error')
    } finally { setSaving(false) }
  }

  const allOptions = events.flatMap((e) => (e.options ?? []).filter((o) => o.included !== false).map((o) => ({ ...o, event_type: e.event_type })))
  const canStep1 = leagueId && weekNumber && lockTime
  const canStep2 = selectedFixtures.length >= 2

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <ConfirmModal
        open={confirmPublish}
        title="Publish Gameweek?"
        message={`This will assign matchups and open picks for all members of "${selectedLeague?.name}". Continue?`}
        confirmLabel="Publish Now 🚀"
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublish(false)}
      />

      <div className="max-w-3xl mx-auto space-y-6">
        <StepIndicator step={step}/>

        {/* ── STEP 0: Basic Info ── */}
        {step === 0 && (
          <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 space-y-5">
            <h2 className="text-white font-semibold text-lg">Basic Information</h2>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">League</label>
              <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="">Select an active league…</option>
                {activeLeagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} — {l.competition}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Week Number</label>
                <input type="number" min={1} value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)}
                  placeholder="1"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Competition</label>
                <input value={selectedLeague?.competition ?? ''}  readOnly
                  className="w-full bg-white/3 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-gray-400"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Lock Time</label>
                <input type="datetime-local" value={lockTime} onChange={(e) => { setLockTime(e.target.value); if (!revealTime) setRevealTime(e.target.value) }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Reveal Time</label>
                <input type="datetime-local" value={revealTime} onChange={(e) => setRevealTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
              </div>
            </div>

            <div className="flex justify-end">
              <ActionButton onClick={handleNext} disabled={!canStep1}>Next →</ActionButton>
            </div>
          </div>
        )}

        {/* ── STEP 1: Import Fixtures ── */}
        {step === 1 && (
          <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 space-y-5">
            <h2 className="text-white font-semibold text-lg">Import Fixtures</h2>
            <FixtureSelector selected={selectedFixtures} onSelect={setSelectedFixtures}/>
            <div className="flex justify-between">
              <ActionButton variant="secondary" onClick={() => setStep(0)}>← Back</ActionButton>
              <ActionButton onClick={handleNext} disabled={!canStep2}>
                Next → ({selectedFixtures.length} fixtures)
              </ActionButton>
            </div>
          </div>
        )}

        {/* ── STEP 2: Review Events & Odds ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#111520] border border-white/8 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-lg mb-4">Review Events & Odds</h2>
              <EnergyDistribution options={allOptions}/>
            </div>

            <div className="space-y-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} onToggleOption={handleToggleOption} onUpdateEnergy={handleUpdateEnergy}/>
              ))}
            </div>

            <div className="flex justify-between">
              <ActionButton variant="secondary" onClick={() => setStep(1)}>← Back</ActionButton>
              <ActionButton onClick={handleNext}>Next →</ActionButton>
            </div>
          </div>
        )}

        {/* ── STEP 3: Publish ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-[#111520] border border-white/8 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold text-lg">Publish Gameweek</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['League', selectedLeague?.name ?? leagueId],
                  ['Week', weekNumber],
                  ['Lock Time', lockTime ? new Date(lockTime).toLocaleString() : '—'],
                  ['Fixtures', selectedFixtures.length],
                  ['Events', events.length],
                  ['Options', allOptions.length],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>

              <EnergyDistribution options={allOptions}/>

              {/* Compact event preview */}
              <div className="space-y-2">
                <p className="text-gray-400 text-xs uppercase tracking-wider">Events Preview</p>
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2 bg-white/3 rounded-xl">
                    <span className="text-gray-300 text-sm flex-1">{e.fixture_name}</span>
                    <span className="text-xs text-gray-500">{e.event_type?.replace('_', ' ')}</span>
                    <span className="text-xs text-indigo-400">{(e.options ?? []).filter((o) => o.included !== false).length} opts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <ActionButton variant="secondary" onClick={() => setStep(2)}>← Back</ActionButton>
              <div className="flex gap-3">
                <ActionButton variant="secondary" onClick={handleSaveDraft} loading={saving}>
                  Save as Draft
                </ActionButton>
                <ActionButton variant="success" onClick={() => setConfirmPublish(true)} loading={saving}>
                  Publish Now 🚀
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
