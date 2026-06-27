import client from './client'

export const getDashboard = (range = '30d') => client.get('/admin/dashboard', { params: { range } })
