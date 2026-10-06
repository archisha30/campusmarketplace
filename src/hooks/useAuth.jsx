import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../services/api.js'
import { syncHistory } from '../lib/recommendations.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  // Merge this account's saved browsing history with anything viewed as a guest on this device.
  useEffect(() => {
    if (user) syncHistory(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const value = {
    user,
    loading,
    isVerified: Boolean(user?.verified),
    // Owners (OWNER_EMAILS on the backend) and the admins they approved.
    isAdmin: Boolean(user?.is_admin || user?.role === 'admin'),
    // Only owners can approve or remove admins.
    isOwner: Boolean(user?.is_owner),
    // Sellers can buy and sell; buyers can only buy. Admins can do everything.
    isSeller: user?.account_type === 'seller' || user?.role === 'admin',
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
    async saveInterests(interests) {
      const updated = await authApi.saveInterests(interests)
      setUser(updated)
      return updated
    },
    async becomeSeller() {
      const updated = await authApi.setAccountType('seller')
      setUser(updated)
      return updated
    },
    async updateProfile(payload) {
      const updated = await authApi.updateProfile(payload)
      setUser(updated)
      return updated
    },
    async uploadAvatar(file) {
      const updated = await authApi.uploadAvatar(file)
      setUser(updated)
      return updated
    },
    async removeAvatar() {
      const updated = await authApi.removeAvatar()
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
