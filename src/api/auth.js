import client from './client'

export const postAdminLogin = (email, password) =>
  client.post('/auth/login', { email, password })
