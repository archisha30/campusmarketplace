import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { adminApi } from '../services/api.js'
import { useAuth } from './useAuth.jsx'
import { usePolling } from './usePolling.js'

const POLL_MS = 60_000 // same as notifications
const EMPTY = { open: 0, serious_open: 0, held: 0, loaded: false } // loaded: real counts, not the placeholder

const ReportSummaryContext = createContext({ summary: EMPTY, refresh: () => {} })

// How admins hear about reports: in-app only (never email). One poll of
// GET /api/admin/reports/summary feeds the Admin badge in the navbar, the Reports tab badge
// and the pop-up on /admin. Non-admins never call it. Pages that resolve a report or remove
// an item call refresh() so the badge updates straight away.
export function ReportSummaryProvider({ children }) {
  const { isAdmin, needsPassword } = useAuth()
  const active = isAdmin && !needsPassword
  const [summary, setSummary] = useState(EMPTY)

  const refresh = useCallback(() => {
    if (!active) {
      setSummary(EMPTY)
      return
    }
    adminApi.reportSummary().then((s) => setSummary({ ...s, loaded: true })).catch(() => {})
  }, [active])

  useEffect(() => {
    refresh()
  }, [refresh])
  usePolling(refresh, POLL_MS, active)

  return <ReportSummaryContext.Provider value={{ summary, refresh }}>{children}</ReportSummaryContext.Provider>
}

export function useReportSummary() {
  return useContext(ReportSummaryContext)
}
