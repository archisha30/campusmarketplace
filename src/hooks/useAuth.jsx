import { createContext, useContext, useEffect, useState } from 'react'
import { IS_MOCK, authApi } from '../services/api.js'
import { syncHistory } from '../lib/recommendations.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Why the user was logged out, shown on the login page (e.g. their account was suspended).
  const [notice, setNotice] = useState('')

  useEffect(() => {
    function suspended(e) {
      setUser(null)
      setNotice(e.detail)
      authApi.logout().catch(() => {}) // clear the session cookie
    }
    window.addEventListener('cm:account-suspended', suspended)
    return () => window.removeEventListener('cm:account-suspended', suspended)
  }, [])

  useEffect(() => {
    // Older versions kept the session in browser storage, where injected scripts could read it.
    // Swap it for the HttpOnly cookie once, then delete it, so nobody is logged out by the change.
    const stored = !IS_MOCK && localStorage.getItem('cm_token')
    const loadUser = stored
      ? authApi
          .migrateStoredSession(stored)
          .then((res) => res.user)
          .catch(() => null)
          .finally(() => localStorage.removeItem('cm_token'))
      : authApi.me()

    loadUser
      .then((u) => {
        setUser(u)
        // Stay logged in: each visit renews the session cookie for another 30 days.
        if (u && !stored) authApi.refreshSession().catch(() => {})
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // Merge this account's saved browsing history with anything viewed as a guest on this device.
  useEffect(() => {
    if (user) syncHistory(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // The session cookie was set by the server (HttpOnly); we only keep the user.
  function startSession(res) {
    setUser(res.user)
    return res.user
  }

  const value = {
    user,
    loading,
    notice,
    isVerified: Boolean(user?.verified),
    // Owners (OWNER_EMAILS on the backend) and the admins they approved.
    isAdmin: Boolean(user?.is_admin || user?.role === 'admin'),
    // Only owners can approve or remove admins.
    isOwner: Boolean(user?.is_owner),
    // Sellers can buy and sell; buyers can only buy. Admins can do everything.
    isSeller: user?.account_type === 'seller' || user?.role === 'admin',
    // Old email-only accounts must create a password before doing anything else (Google accounts don't).
    needsPassword: Boolean(user && (user.needs_password ?? user.has_password === false)),
    // Continue with Google: returns { user, created } (created = brand-new account -> onboarding).
    async googleSignIn(credential, accountType) {
      const res = await authApi.googleSignIn(credential, accountType)
      setUser(res.user)
      return res
    },
    async login(email, password) {
      setNotice('')
      return startSession(await authApi.login(email, password))
    },
    async signupVerify(payload) {
      return startSession(await authApi.signupVerify(payload))
    },
    async resetPassword(payload) {
      return startSession(await authApi.resetPassword(payload))
    },
    async setPassword(password, confirmPassword) {
      // Returns a fresh session: changing the password logs out the old one.
      return startSession(await authApi.setPassword(password, confirmPassword))
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
      await authApi.logout().catch(() => {}) // clears the cookie; log out locally either way
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
