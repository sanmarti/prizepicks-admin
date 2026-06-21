import client from './client'

export const listDivisions   = ()        => client.get('/admin/divisions')
export const createDivision  = (data)    => client.post('/admin/divisions', data)
export const updateDivision  = (id, data)=> client.put(`/admin/divisions/${id}`, data)
export const getDivisionUsers = (id)     => client.get(`/admin/divisions/${id}/users`)
