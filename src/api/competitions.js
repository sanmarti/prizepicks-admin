import client from './client'

export const getCompetitions    = ()       => client.get('/admin/competitions')
export const createCompetition  = (data)   => client.post('/admin/competitions', data)
export const updateCompetition  = (id, data) => client.put(`/admin/competitions/${id}`, data)
export const deleteCompetition  = (id)     => client.delete(`/admin/competitions/${id}`)
