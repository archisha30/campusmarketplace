import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Footer() {
  const { isAdmin, isSeller } = useAuth()
  const { pathname } = useLocation()
  const onDashboard = pathname.startsWith('/dashboard')
  return (
    <footer className="mt-section-sm border-t border-line">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-8">
        <div>
          <p className="hd text-[22px]">Campus Market</p>
          <p className="mt-1 text-sm text-ink-soft">© 2026 CampusMarket · Built by students, for students</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] font-medium">
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          {/* Sellers' way into their dashboard; hidden when they're already on it. */}
          {isSeller && !onDashboard && <Link to="/dashboard">Seller dashboard</Link>}
          {isAdmin && <Link to="/admin">Admin</Link>}
        </nav>
      </div>
    </footer>
  )
}
