import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import HowItWorksSteps from '../components/HowItWorksSteps.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

// Public, unlike the landing page (which sends logged-in students to the marketplace): everyone can
// read this. Students who are logged in get a way into the marketplace, visitors a way to sign up.
export default function HowItWorks() {
  const { user, loading } = useAuth()

  // Opened from a link further down another page: start at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-12 md:py-16">
      <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 text-[34px] font-bold leading-tight md:text-[44px]">How it works</h1>
          <p className="text-[17px] text-ink-soft">Three steps from browsing to handshake.</p>
        </div>
        {/* Keeps its height while the session is checked, so nothing jumps or shows the wrong button. */}
        <div className="flex min-h-[43px] flex-wrap gap-3">
          {loading ? null : user ? (
            <Link to="/marketplace" className="btn-accent">Go to Marketplace →</Link>
          ) : (
            <>
              <Link to="/signup" className="btn-accent">Sign up to explore</Link>
              <Link to="/login" className="btn-ghost">Log in</Link>
            </>
          )}
        </div>
      </div>
      <HowItWorksSteps heading="h2" />
    </div>
  )
}
