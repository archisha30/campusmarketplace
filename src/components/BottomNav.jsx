import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Home', d: 'M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9', end: true },
  { to: '/marketplace', label: 'Market', d: 'M4 8h16l-1.5 11.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8ZM8 8V6a4 4 0 0 1 8 0v2' },
  { to: '/resources', label: 'Resources', d: 'M4 5h10a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2V5ZM20 20V6a2 2 0 0 0-2-2h-2' },
  { to: '/sell', label: 'Sell', d: 'M12 5v14M5 12h14' },
  { to: '/dashboard', label: 'Profile', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c1.5-4 5-6 8-6s6.5 2 8 6' },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper px-1 pb-2.5 pt-2 md:hidden">
      <div className="flex justify-around">
        {ITEMS.map((it) => (
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
