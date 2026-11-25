import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useWishlist } from '../hooks/useWishlist.jsx'
import Avatar from './Avatar.jsx'
import { useRequestNotifications } from '../hooks/useRequestNotifications.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { useReportSummary } from '../hooks/useReportSummary.jsx'

// Everyone sees "How It Works"; the marketplace and Resource Hub links appear once they've
// logged in or signed up.
const HOW_LINK = { to: '/#how-it-works', label: 'How It Works' }
const GUEST_LINKS = [HOW_LINK]
const MEMBER_LINKS = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/resources', label: 'Resource Hub' },
  // Wide screens only in the top bar: there's no room beside the logged-in buttons on a tablet
  // (the footer links to it at every size).
  { ...HOW_LINK, wideOnly: true },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, isSeller, isAdmin, probablyMember } = useAuth()
  const { count } = useWishlist()
  const { summary } = useReportSummary() // admins only; zeros for everyone else
  const badge = (l) => (l.to === '/admin' && summary.open > 0 ? <CountBadge n={summary.open} label="open reports" /> : null)
  const links = user || probablyMember ? [...MEMBER_LINKS, ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : [])] : GUEST_LINKS

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-2 px-4 md:px-6">
        <Logo />

        <nav className="hidden gap-0.5 md:flex lg:gap-1.5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-pill px-2.5 py-2 text-[14.5px] lg:px-3.5 font-medium transition ${l.wideOnly ? 'hidden lg:block' : ''} ${
                  isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-black/5 hover:text-ink'
                }`
              }
            >
              {l.label}
              {badge(l)}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 md:gap-2.5">
          {user && (
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
          )}
          {user ? (
            <>
              <RequestBell />
              {isSeller && <Link to="/sell" className="btn-ghost btn-sm hidden md:inline-flex">Sell</Link>}
              <Link
                to="/profile"
                aria-label="My profile"
                className="flex items-center gap-2 rounded-pill border-[1.5px] border-line py-1 pl-1 pr-1 transition hover:border-ink lg:pr-3"
              >
                <Avatar user={user} size={28} />
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block max-w-[84px] truncate xl:max-w-[120px] text-[13px] font-semibold">{user.name || 'Account'}</span>
                  <span className="block text-[11px] text-ink-faint">{isAdmin ? 'Admin' : isSeller ? 'Seller' : 'Buyer'}</span>
                </span>
              </Link>
            </>
          ) : probablyMember ? (
            <span className="skeleton h-9 w-9 !rounded-full" aria-hidden />
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm hidden whitespace-nowrap md:inline-flex">Log In</Link>
              <Link to="/signup" className="btn-primary btn-sm mr-1 whitespace-nowrap md:mr-0">Get Started</Link>
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
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="flex items-center rounded-xl px-3 py-3 text-base font-medium text-ink-soft"
            >
              {l.label}
              {badge(l)}
            </Link>
          ))}
          {user && (
            <Link
              to="/wishlist"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-base font-medium text-ink-soft"
            >
              My Wishlist{count > 0 ? ` (${count})` : ''}
            </Link>
          )}
          {!user && !probablyMember && (
            <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost mt-2 w-full">Log In</Link>
          )}
        </div>
      )}
    </header>
  )
}

// Everyone gets the bell. Sellers' badge also counts new Looking For requests and opens their
// dashboard; buyers' opens /notifications (the dashboard is seller-only).
function RequestBell() {
  const { isSeller } = useAuth()
  const { unread: requests } = useRequestNotifications({ poll: true }) // always 0 for buyers
  const { unread: personal } = useNotifications({ poll: true })
  const unread = requests + personal
  const to = !isSeller ? '/notifications' : personal > 0 || requests === 0 ? '/dashboard#notifications' : '/dashboard#requests'
  return (
    <Link
      to={to}
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

// The bell's red count, inline after a link's label (Admin → open reports).
export function CountBadge({ n, label }) {
  return (
    <span
      aria-label={`${n} ${label}`}
      className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-coral px-1 align-middle text-[10.5px] font-bold text-white"
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}
