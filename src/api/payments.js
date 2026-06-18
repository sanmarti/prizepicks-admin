import client from './client'

export const getPrizePools  = ()         => client.get('/admin/payments')
export const triggerPayout  = (leagueId) => client.post('/admin/payments/payout', { league_id: leagueId })
