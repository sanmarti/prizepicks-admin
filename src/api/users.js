import client from './client'

export const getUsers        = ()             => client.get('/admin/users')
export const getUserDetail   = (id)           => client.get(`/admin/users/${id}`)
export const banUser         = (id)           => client.post(`/admin/users/${id}/ban`)
export const updateUserRole  = (id, role)     => client.put(`/admin/users/${id}/role`, { role })
export const getUserEnergy   = (id)           => client.get(`/admin/users/${id}/energy`)
export const adjustEnergy    = (id, amount, description) =>
  client.post(`/admin/users/${id}/energy`, { amount, description })
export const deleteUser             = (id) => client.delete(`/admin/users/${id}`)
export const resetUserPassword      = (id) => client.post(`/admin/users/${id}/reset-password`)
export const getUserNotifications   = (id) => client.get(`/admin/users/${id}/notifications`)
