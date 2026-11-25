import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

// "Ready to browse?" on the home page, where logged-in students land when they open the website.
// The page stays readable behind it; × hides it until the next visit.
export default function MarketplacePopup() {
  const { user, isVerified, needsPassword } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 700) // let the page show first
    return () => clearTimeout(t)
  }, [])

  if (!open || !isVerified || needsPassword) return null

  const firstName = (user.name || '').trim().split(/\s+/)[0]
  return (
    // A slim bar, so it doesn't sit on the page's own buttons: above the tab bar on phones, in the
    // bottom-left corner on larger screens. Under real modals (z-100), which need an answer first.
    <div
      role="region"
      aria-label="Go to the marketplace"
      className="fixed inset-x-3 bottom-[82px] z-40 flex animate-[fadeIn_.3s_ease] items-center gap-2 rounded-card border border-line bg-paper py-2.5 pl-3.5 pr-10 shadow-xl md:bottom-5 md:left-6 md:right-auto md:max-w-[460px] md:gap-5"
    >
      <p className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold md:text-[16px]">
        {firstName && <span className="hidden md:inline">Hi {firstName}, ready</span>}
        <span className={firstName ? 'md:hidden' : ''}>Ready</span> to browse?
      </p>
      <Link to="/marketplace" className="btn-accent btn-sm shrink-0 px-3 py-2">Go to Marketplace →</Link>
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-lg text-ink-faint transition hover:bg-black/5 hover:text-ink"
      >
        ×
      </button>
    </div>
  )
}
