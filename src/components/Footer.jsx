import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Footer() {
  const { isAdmin } = useAuth()
  return (
    <footer className="mt-10 border-t border-line py-9">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 text-[13.5px] text-ink-faint">
        <span>© 2026 CampusMarket · Built by students, for students</span>
        <span className="flex gap-4">
          <Link to="/dashboard" className="hover:text-ink">Seller dashboard</Link>
          {isAdmin && <Link to="/admin" className="hover:text-ink">Admin</Link>}
        </span>
      </div>
    </footer>
  )
}
