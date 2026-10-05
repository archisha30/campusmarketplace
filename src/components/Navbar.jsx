import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useWishlist } from '../hooks/useWishlist.jsx'
import Avatar from './Avatar.jsx'
import { useRequestNotifications } from '../hooks/useRequestNotifications.js'
import { useNotifications } from '../hooks/useNotifications.js'

const LINKS = [
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/resources', label: 'Resource Hub' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, isSeller, isAdmin } = useAuth()
  const { count } = useWishlist()

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
          <Link
            to="/wishlist"
            aria-label={`My Wishlist (${count} saved)`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-lg text-ink-soft transition hover:bg-black/5 hover:text-ink"
          >
            ♡
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-coral px-1 text-[10.5px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <>
              {isSeller && <RequestBell />}
              {isSeller && <Link to="/sell" className="btn-ghost btn-sm hidden md:inline-flex">Sell</Link>}
              <Link
                to="/profile"
                aria-label="My profile"
                className="flex items-center gap-2 rounded-pill border-[1.5px] border-line py-1 pl-1 pr-1 transition hover:border-ink md:pr-3"
              >
                <Avatar user={user} size={28} />
                <span className="hidden text-left leading-tight md:block">
                  <span className="block max-w-[120px] truncate text-[13px] font-semibold">{user.name || 'Account'}</span>
                  <span className="block text-[11px] text-ink-faint">{isAdmin ? 'Admin' : isSeller ? 'Seller' : 'Buyer'}</span>
                </span>
              </Link>
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
          <Link
            to="/wishlist"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-3 text-base font-medium text-ink-soft"
          >
            My Wishlist{count > 0 ? ` (${count})` : ''}
          </Link>
          {!user && (
            <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost mt-2 w-full">Log In</Link>
          )}
        </div>
      )}
    </header>
  )
}

function RequestBell() {
  const { unread: requests } = useRequestNotifications({ poll: true })
  const { unread: personal } = useNotifications({ poll: true })
  const unread = requests + personal
  return (
    <Link
      to={personal > 0 || requests === 0 ? '/dashboard#notifications' : '/dashboard#requests'}
      aria-label={unread ? `${unread} new notifications` : 'Notifications'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-black/5 hover:text-ink"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-coral px-1 text-[10.5px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
