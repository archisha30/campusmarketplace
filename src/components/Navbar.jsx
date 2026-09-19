import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

const LINKS = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/resources', label: 'Resource Hub' },
  { to: '/#how-it-works', label: 'How It Works' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-6">
        <Logo />

        <nav className="hidden gap-1.5 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-pill px-3.5 py-2 text-[14.5px] font-medium transition ${
                  isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-black/5 hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <Link to="/dashboard" className="btn-ghost btn-sm hidden md:inline-flex">My Listings</Link>
              <button className="btn-primary btn-sm" onClick={() => logout().then(() => navigate('/'))}>Log Out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm hidden md:inline-flex">Log In</Link>
              <Link to="/signup" className="btn-primary btn-sm">Get Started</Link>
            </>
          )}
          <button
            className="p-1.5 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="mb-1.5 block h-0.5 w-[22px] rounded bg-ink" />
            <span className="mb-1.5 block h-0.5 w-[22px] rounded bg-ink" />
            <span className="block h-0.5 w-[22px] rounded bg-ink" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-paper px-6 py-4 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-base font-medium text-ink-soft"
            >
              {l.label}
            </Link>
          ))}
          {!user && (
            <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost mt-2 w-full">Log In</Link>
          )}
        </div>
      )}
    </header>
  )
}
