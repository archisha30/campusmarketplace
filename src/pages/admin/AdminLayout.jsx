import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.jsx'

const TABS = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/content', label: 'Listings & Resources' },
]

// Shell for the admin pages. Only owners (OWNER_EMAILS) and admins they approved get here;
// the route guard and every /api/admin endpoint check that.
export default function AdminLayout() {
  const { isOwner } = useAuth()
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold">Admin</h1>
        <span className="badge bg-ink text-white">{isOwner ? 'Owner' : 'Admin'}</span>
      </div>
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
          </NavLink>
        ))}
      </nav>
      <Outlet />
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
