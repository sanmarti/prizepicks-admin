import { create } from 'zustand'

const TOKEN_KEY = 'pp_admin_token'

export const useAdminAuthStore = create((set) => ({
  admin: (() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY)
      if (!t) return null
      const payload = JSON.parse(atob(t.split('.')[1]))
      return payload.role === 'admin' ? payload : null
    } catch { return null }
  })(),
  token: localStorage.getItem(TOKEN_KEY) ?? null,

  login(data) {
    localStorage.setItem(TOKEN_KEY, data.token)
    const payload = JSON.parse(atob(data.token.split('.')[1]))
    set({ token: data.token, admin: payload })
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, admin: null })
    window.location.href = '/admin/login'
  },
}))
