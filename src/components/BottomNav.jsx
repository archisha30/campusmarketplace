import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const ITEMS = [
  { to: '/', label: 'Home', d: 'M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9', end: true },
  { to: '/marketplace', label: 'Market', d: 'M4 8h16l-1.5 11.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8ZM8 8V6a4 4 0 0 1 8 0v2' },
  { to: '/resources', label: 'Resources', d: 'M4 5h10a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2V5ZM20 20V6a2 2 0 0 0-2-2h-2' },
  { to: '/sell', label: 'Sell', d: 'M12 5v14M5 12h14', sellerOnly: true },
  { to: '/wishlist', label: 'Wishlist', d: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z', buyerOnly: true },
  { to: '/profile', label: 'Profile', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c1.5-4 5-6 8-6s6.5 2 8 6' },
]

// Logged-out visitors get no marketplace / Resource Hub tabs, just a way in.
const GUEST_ITEMS = [
  ITEMS[0],
  { to: '/login', label: 'Log in', d: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3' },
  { to: '/signup', label: 'Sign up', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c1.5-4 5-6 8-6s6.5 2 8 6M19 8v6M16 11h6' },
]

export default function BottomNav() {
  const { user, isSeller } = useAuth()
  // Once logged in there's no Home tab: students only use the Marketplace and Resource Hub.
  const items = user
    ? ITEMS.slice(1).filter((it) => (isSeller ? !it.buyerOnly : !it.sellerOnly))
    : GUEST_ITEMS

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper px-1 pb-2.5 pt-2 md:hidden">
      <div className="flex justify-around">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex min-w-[56px] flex-col items-center gap-0.5 px-2 py-1 text-[10.5px] font-semibold ${
                isActive ? 'text-brand' : 'text-ink-faint'
              }`
            }
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={it.d} />
            </svg>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
