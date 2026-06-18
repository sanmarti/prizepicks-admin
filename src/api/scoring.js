import client from './client'

export const resolveGameweek = (gameweekId) =>
  client.post('/scoring/resolve', { gameweek_id: gameweekId })

export const overridePick = (pickId, result, reason) =>
  client.put(`/admin/picks/${pickId}/override`, { result, reason })
