import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useReportSummary } from '../../hooks/useReportSummary.jsx'
import { CountBadge } from '../../components/Navbar.jsx'

const TABS = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/content', label: 'Listings & Resources' },
  { to: '/admin/reports', label: 'Reports' },
]

// Shell for the admin pages. Only owners (OWNER_EMAILS) and admins they approved get here;
// the route guard and every /api/admin endpoint check that.
export default function AdminLayout() {
  const { isOwner } = useAuth()
  const { summary, refresh } = useReportSummary()
  // Fresh counts as soon as the admin area opens, not up to a minute later.
  useEffect(() => {
    refresh()
  }, [refresh])
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold">Admin</h1>
        <span className="badge bg-ink text-white">{isOwner ? 'Owner' : 'Admin'}</span>
      </div>
      {summary.loaded && <ReviewAlert serious={summary.serious_open} held={summary.held} />}
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `rounded-pill border-[1.5px] px-4 py-2.5 text-[13.5px] font-semibold ${
                isActive ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink-soft hover:border-ink'
              }`
            }
          >
            {t.label}
            {t.to === '/admin/reports' && summary.open > 0 && <CountBadge n={summary.open} label="open reports" />}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}

const DISMISSED_KEY = 'cm_admin_alert_dismissed'

function readDismissed() {
  try {
    return Number(sessionStorage.getItem(DISMISSED_KEY)) || 0
  } catch {
    return 0
  }
}

// The red heads-up on every /admin page: scam/prohibited reports (sellers aren't told until
// someone looks) and items held after a pile-up of reports. ✕ hides it for this browser
// session, until the number goes up again.
function ReviewAlert({ serious, held }) {
  const total = serious + held
  const [dismissedAt, setDismissedAt] = useState(readDismissed)

  function remember(n) {
    setDismissedAt(n)
    try {
      sessionStorage.setItem(DISMISSED_KEY, String(n))
    } catch {
      // storage blocked: it just comes back on the next page load
    }
  }

  // Once some are reviewed, follow the count down, so the next new one shows again.
  useEffect(() => {
    if (total < dismissedAt) remember(total)
  }, [total, dismissedAt])

  if (total === 0 || total <= dismissedAt) return null
  const dismiss = () => remember(total)

  const parts = [
    serious > 0 && `${serious} scam/prohibited report${serious === 1 ? '' : 's'}`,
    held > 0 && `${held} held item${held === 1 ? '' : 's'}`,
  ].filter(Boolean)
  return (
    <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-card border border-coral/40 bg-coral/10 px-4 py-3 text-[14px] text-coral">
      <span className="flex-1 font-semibold">⚠ {parts.join(' and ')} need{total === 1 ? 's' : ''} review</span>
      <Link to="/admin/reports" className="btn-danger btn-sm">Review</Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none hover:bg-coral/15"
      >
        ×
      </button>
    </div>
  )
}

export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-line bg-[#FAFAF7] px-3.5 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }) {
  return <td className={`border-b border-line px-3.5 py-3 align-top text-[13.5px] ${className}`}>{children}</td>
}

export function Stat({ label, value }) {
  return (
    <div className="rounded-card border border-line bg-paper px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-display text-[22px] font-bold">{value}</p>
    </div>
  )
}

export function formatDate(iso) {
  if (!iso) return '—'
  const t = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
