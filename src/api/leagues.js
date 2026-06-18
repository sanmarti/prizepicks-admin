import client from './client'

export const getLeagues          = ()              => client.get('/admin/leagues')
export const getLeague           = (id)            => client.get(`/leagues/${id}`)
export const updateLeagueStatus  = (id, status)    => client.put(`/leagues/${id}`, { status })
