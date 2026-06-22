import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { listEnergyPacks, createEnergyPack, updateEnergyPack, deleteEnergyPack } from '../../api/energyPacks'
import { useToast } from '../../hooks/useToast'
import ActionButton from '../../components/admin/ui/ActionButton'
import ConfirmModal from '../../components/admin/ui/ConfirmModal'
import ToastContainer from '../../components/admin/ui/ToastContainer'

const EMPTY = {
  name: '', description: '', image_url: '', energy_amount: 10,
  price_euros: 0.99, discount_pct: 0, is_active: true, display_order: 0,
}

function PackModal({ pack, onSave, onClose, saving }) {
  const [form, setForm] = useState(pack || EMPTY)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const originalPrice = form.discount_pct > 0
    ? (parseFloat(form.price_euros) / (1 - form.discount_pct / 100)).toFixed(2)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-white font-bold text-base">{pack ? 'Edit Pack' : 'New Energy Pack'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Preview */}
          <div className="rounded-2xl border border-white/8 p-4 flex items-center gap-4 bg-white/2">
            <div className="w-16 h-16 rounded-xl bg-yellow-900/30 border border-yellow-500/30 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
              {form.image_url
                ? <img src={form.image_url} alt="" className="w-full h-full object-cover rounded-xl" onError={e => { e.target.style.display='none' }} />
                : '⚡'}
            </div>
            <div>
              <p className="text-white font-bold">{form.name || 'Pack Name'}</p>
              <p className="text-yellow-400 font-black text-lg">+{form.energy_amount} ⚡</p>
              <div className="flex items-center gap-2">
                {originalPrice && <span className="text-gray-600 text-xs line-through">€{originalPrice}</span>}
                <span className="text-green-400 font-bold text-sm">€{parseFloat(form.price_euros).toFixed(2)}</span>
                {form.discount_pct > 0 && <span className="text-xs bg-red-900/50 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">-{form.discount_pct}%</span>}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Pack name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Starter Boost" />
            </div>
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Description</label>
              <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Short description shown to users" />
            </div>
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Image URL</label>
              <input value={form.image_url || ''} onChange={e => set('image_url', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="https://… (optional)" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Energy amount ⚡ *</label>
              <input type="number" min="1" value={form.energy_amount} onChange={e => set('energy_amount', parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Price (€) *</label>
              <input type="number" min="0" step="0.01" value={form.price_euros} onChange={e => set('price_euros', parseFloat(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Discount %</label>
              <input type="number" min="0" max="100" value={form.discount_pct} onChange={e => set('discount_pct', parseInt(e.target.value) || 0)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Display order</label>
              <input type="number" min="0" value={form.display_order} onChange={e => set('display_order', parseInt(e.target.value) || 0)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-indigo-600' : 'bg-white/10'}`}
              onClick={() => set('is_active', !form.is_active)}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.is_active ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-gray-300 text-sm">{form.is_active ? 'Active — visible to users' : 'Inactive — hidden from users'}</span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-white/8 flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onClose}>Cancel</ActionButton>
          <ActionButton onClick={() => onSave(form)} loading={saving}
            disabled={!form.name || !form.energy_amount}>
            {pack ? 'Save changes' : 'Create pack'}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

export default function EnergyPacksPage() {
  const { data: packs, loading, refetch } = useApi(listEnergyPacks)
  const { toasts, toast } = useToast()
  const [editing, setEditing]   = useState(null)   // null | EMPTY-like | existing pack
  const [creating, setCreating] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [saving, setSaving]     = useState(false)

  async function handleSave(form) {
    setSaving(true)
    try {
      if (editing?.id) {
        await updateEnergyPack(editing.id, form)
        toast('Pack updated')
      } else {
        await createEnergyPack(form)
        toast('Pack created')
      }
      setEditing(null); setCreating(false); refetch()
    } catch { toast('Failed to save pack', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    try {
      await deleteEnergyPack(delTarget.id)
      toast('Pack deleted'); refetch()
    } catch { toast('Failed to delete', 'error') }
    finally { setDelTarget(null) }
  }

  const sorted = [...(packs || [])].sort((a, b) => a.display_order - b.display_order || a.price_euros - b.price_euros)

  return (
    <>
      <ToastContainer toasts={toasts} />

      {(editing !== null || creating) && (
        <PackModal
          pack={editing?.id ? editing : null}
          onSave={handleSave}
          onClose={() => { setEditing(null); setCreating(false) }}
          saving={saving}
        />
      )}

      <ConfirmModal
        open={!!delTarget} danger
        title={`Delete "${delTarget?.name}"?`}
        message="This pack will be removed and users won't be able to purchase it."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold">⚡ Energy Packs</h1>
            <p className="text-gray-500 text-sm mt-0.5">Define purchasable energy bundles for users</p>
          </div>
          <ActionButton onClick={() => setCreating(true)}>+ New Pack</ActionButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total packs', value: sorted.length, icon: '📦' },
            { label: 'Active packs', value: sorted.filter(p => p.is_active).length, icon: '✅' },
            { label: 'Cheapest pack', value: sorted.length ? `€${Math.min(...sorted.map(p => parseFloat(p.price_euros))).toFixed(2)}` : '—', icon: '💰' },
          ].map(k => (
            <div key={k.label} className="bg-[#0d1117] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">{k.icon}</span>
              <div>
                <p className="text-white font-black text-xl">{k.value}</p>
                <p className="text-gray-500 text-xs">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Packs grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 bg-[#0d1117] border border-white/8 rounded-2xl">
            <p className="text-4xl mb-3">⚡</p>
            <p className="text-gray-400 font-semibold">No energy packs yet</p>
            <p className="text-gray-600 text-sm mt-1">Create your first pack to let users boost their energy</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map(pack => {
              const originalPrice = pack.discount_pct > 0
                ? (parseFloat(pack.price_euros) / (1 - pack.discount_pct / 100)).toFixed(2)
                : null
              return (
                <div key={pack.id}
                  className={`bg-[#0d1117] border rounded-2xl overflow-hidden transition-all ${pack.is_active ? 'border-white/10' : 'border-white/4 opacity-50'}`}>
                  {/* Image / icon */}
                  <div className="h-32 bg-gradient-to-br from-yellow-950/50 to-amber-900/20 flex items-center justify-center relative overflow-hidden">
                    {pack.image_url
                      ? <img src={pack.image_url} alt={pack.name} className="w-full h-full object-cover" />
                      : <span className="text-5xl">⚡</span>}
                    {!pack.is_active && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-xs bg-white/10 text-gray-400 border border-white/10 px-2 py-1 rounded-full">INACTIVE</span>
                      </div>
                    )}
                    {pack.discount_pct > 0 && (
                      <span className="absolute top-2 right-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                        -{pack.discount_pct}%
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-white font-bold">{pack.name}</p>
                      {pack.description && <p className="text-gray-500 text-xs mt-0.5">{pack.description}</p>}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-yellow-400 font-black text-xl">+{pack.energy_amount} ⚡</span>
                      <div className="text-right">
                        {originalPrice && <p className="text-gray-600 text-xs line-through">€{originalPrice}</p>}
                        <p className="text-green-400 font-black text-lg">€{parseFloat(pack.price_euros).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-white/6">
                      <ActionButton size="sm" variant="ghost" onClick={() => setEditing(pack)} className="flex-1">✏️ Edit</ActionButton>
                      <ActionButton size="sm" variant="danger" onClick={() => setDelTarget(pack)}>🗑</ActionButton>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
