import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const value = {
    user,
    loading,
    isVerified: Boolean(user?.verified),
    isAdmin: user?.role === 'admin',
    async login(email, otp) {
      const res = await authApi.login(email, otp)
      if (res?.token) localStorage.setItem('cm_token', res.token)
      setUser(res.user)
      return res.user
    },
    async completeProfile(payload) {
      const updated = await authApi.completeProfile(payload)
      setUser(updated)
      return updated
    },
    async logout() {
      await authApi.logout()
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
