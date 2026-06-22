import client from './client'

export const getGameweeks    = ()     => client.get('/gameweeks')
export const getGameweek     = (id)   => client.get(`/gameweeks/${id}`)
export const createGameweek    = (data)     => client.post('/admin/gameweek', data)
export const getGameweekDetail = (id)       => client.get(`/admin/gameweek/${id}`)
export const updateGameweek    = (id, data) => client.put(`/admin/gameweek/${id}`, data)
export const publishGameweek   = (id)       => client.post('/admin/publish', { gameweek_id: id })
