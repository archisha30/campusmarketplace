import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useWishlist } from '../hooks/useWishlist.jsx'
import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'
import { useRequestNotifications } from '../hooks/useRequestNotifications.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { useReportSummary } from '../hooks/useReportSummary.jsx'

// Everyone sees "How It Works"; the marketplace and Resource Hub links appear once they've
// logged in or signed up.
const HOW_LINK = { to: '/#how-it-works', label: 'How it works' }
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
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="wrap flex h-[68px] items-center gap-3 md:h-20 md:gap-5 lg:gap-8">
        <Logo />

        <nav className="hidden gap-4 md:flex lg:gap-6">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap py-2 text-[15px] font-medium lg:text-base ${l.wideOnly ? 'hidden lg:block' : ''} ${
                  isActive && !l.to.includes('#') ? 'text-brand shadow-[inset_0_-2px_#2F4BFF]' : 'text-ink'
                }`
              }
            >
              {l.label}
              {badge(l)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2 lg:gap-3">
          {user && (
            <Link
              to="/wishlist"
              aria-label={`My Wishlist (${count} saved)`}
              className="relative flex h-11 w-10 items-center justify-center rounded-control text-ink"
            >
              <Icon name="heart" size={22} />
              {count > 0 && <CornerCount className="bg-brand">{count}</CornerCount>}
            </Link>
          )}
          {user ? (
            <>
              <RequestBell />
              {isSeller && <Link to="/sell" className="btn-primary btn-sm hidden md:inline-flex">Sell</Link>}
              <Link
                to="/profile"
                aria-label="My profile"
                className="ml-1 flex h-11 items-center gap-2 rounded-control border border-line bg-paper px-1.5 hover:border-ink lg:pr-3"
              >
                <Avatar user={user} size={30} />
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block max-w-[84px] truncate text-sm font-semibold xl:max-w-[120px]">{user.name || 'Account'}</span>
                  <span className="block text-xs text-ink-soft">{isAdmin ? 'Admin' : isSeller ? 'Seller' : 'Buyer'}</span>
                </span>
              </Link>
            </>
          ) : probablyMember ? (
            <span className="skeleton h-9 w-9 !rounded-full" aria-hidden />
          ) : (
            <>
              <Link to="/login" className="hidden whitespace-nowrap px-2 font-semibold md:block">Log in</Link>
              <Link to="/signup" className="btn-primary btn-sm whitespace-nowrap !gap-1 md:h-11 md:px-6 md:text-base">
                Join<span className="hidden md:inline">with college email</span>
              </Link>
            </>
          )}
          <button
            className="flex h-11 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="block h-0.5 w-[22px] rounded bg-ink" />
            <span className="block h-0.5 w-[22px] rounded bg-ink" />
            <span className="block h-0.5 w-[22px] rounded bg-ink" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-paper px-4 py-4 md:hidden">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="flex items-center rounded-xl px-3 py-3 text-base font-medium text-ink"
            >
              {l.label}
              {badge(l)}
            </Link>
          ))}
          {user && (
            <Link
              to="/wishlist"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-base font-medium text-ink"
            >
              My Wishlist{count > 0 ? ` (${count})` : ''}
            </Link>
          )}
          {!user && !probablyMember && (
            <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost mt-2 w-full">Log in</Link>
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
      className="relative flex h-11 w-10 items-center justify-center rounded-control text-ink"
    >
      <Icon name="bell" size={22} />
      {unread > 0 && <CornerCount className="bg-coral">{unread > 9 ? '9+' : unread}</CornerCount>}
    </Link>
  )
}

function CornerCount({ className, children }) {
  return (
    <span className={`absolute right-0 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${className}`}>
      {children}
    </span>
  )
}

// The bell's red count, inline after a link's label (Admin → open reports).
export function CountBadge({ n, label }) {
  return (
    <span
      aria-label={`${n} ${label}`}
      className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral px-1 align-middle text-[11px] font-bold text-white"
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}
