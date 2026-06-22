import client from './client'

export const listEnergyPacks   = ()         => client.get('/admin/energy-packs')
export const createEnergyPack  = (data)     => client.post('/admin/energy-packs', data)
export const updateEnergyPack  = (id, data) => client.put(`/admin/energy-packs/${id}`, data)
export const deleteEnergyPack  = (id)       => client.delete(`/admin/energy-packs/${id}`)
