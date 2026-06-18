import client from './client'

export const getFixtures = (leagueId, season, round) =>
  client.get('/admin/fixtures', { params: { leagueId, season, round } })
