import client from './client'

export const listSprints         = ()            => client.get('/admin/sprints')
export const createSprint        = (data)        => client.post('/admin/sprints', data)
export const getSprint           = (id)          => client.get(`/admin/sprints/${id}`)
export const updateSprint        = (id, data)    => client.put(`/admin/sprints/${id}`, data)
export const activateSprint      = (id)          => client.post(`/admin/sprints/${id}/activate`)
export const settleSprint        = (id)          => client.post(`/admin/sprints/${id}/settle`)
export const addSprintGameweek   = (id, data)    => client.post(`/admin/sprints/${id}/gameweeks`, data)
export const removeSprintGameweek= (id, gwId)    => client.delete(`/admin/sprints/${id}/gameweeks/${gwId}`)
export const getRankings         = (params)      => client.get('/admin/rankings', { params })
export const getAvailableFixtures= (params)      => client.get('/admin/fixtures/available', { params })
