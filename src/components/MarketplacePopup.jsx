import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

// "Ready to browse?" on /how-it-works, where logged-in students land when they open the website.
// A small card in the corner, so the page stays readable behind it; × hides it until the next visit.
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
    // Above the phone tab bar and (on larger screens) the footer links; under real modals (z-100), which need an answer first.
    <div
      role="region"
      aria-label="Go to the marketplace"
      className="fixed inset-x-4 bottom-[88px] z-40 animate-[fadeIn_.3s_ease] rounded-card border border-line bg-paper p-5 shadow-xl md:inset-x-auto md:bottom-28 md:right-6 md:w-[340px]"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-lg text-ink-faint transition hover:bg-black/5 hover:text-ink"
      >
        ×
      </button>
      <p className="break-words pr-8 font-display text-[17px] font-semibold">{firstName ? `Hi ${firstName}, ready` : 'Ready'} to browse?</p>
      <p className="mb-4 mt-1 text-[13.5px] text-ink-soft">See what students on your campus are selling.</p>
      <Link to="/marketplace" className="btn-accent w-full">Go to Marketplace →</Link>
    </div>
  )
}
