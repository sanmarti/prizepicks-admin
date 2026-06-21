import client from './client'

export const getCompetitions          = ()         => client.get('/admin/competitions')
export const createCompetition        = (data)     => client.post('/admin/competitions', data)
export const updateCompetition        = (id, data) => client.put(`/admin/competitions/${id}`, data)
export const deleteCompetition        = (id)       => client.delete(`/admin/competitions/${id}`)
export const getCompetitionCalendar   = (id)       => client.get(`/admin/competitions/${id}/calendar`)
export const getCompetitionGameweeks  = (id)       => client.get(`/admin/competitions/${id}/gameweeks`)
export const getCompetitionStandings  = (id)       => client.get(`/admin/competitions/${id}/standings`)
export const browseCompetitions       = ()         => client.get('/admin/competitions/browse')
export const importCompetition        = (data)     => client.post('/admin/competitions/import', data)
export const refreshFixtureResults    = (data)     => client.post('/admin/fixtures/refresh-results', data)
