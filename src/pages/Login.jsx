import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { trackEvent } from '../lib/analytics.js'
import PasswordInput from '../components/PasswordInput.jsx'
import GoogleButton from '../components/GoogleButton.jsx'

// Email + password. Every failure gets the same message (so nobody can find out which emails
// have accounts); accounts from before passwords existed create their first one via Forgot password.
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await login(email, password)
      trackEvent('login', { method: 'password' })
      if (u?.profile_completed === false) navigate('/onboarding', { replace: true })
      else navigate(location.state?.from || '/marketplace', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[420px] rounded-slab border border-line bg-paper p-8 md:p-10">
      <h2 className="mb-2 text-[26px] font-bold">Welcome back</h2>
      <p className="mb-6 text-sm text-ink-soft">Log in with your college email and password.</p>

      <GoogleButton
        onSuccess={({ user, created }) => {
          trackEvent(created ? 'sign_up' : 'login', { method: 'google' })
          if (!user.profile_completed) navigate('/onboarding', { replace: true })
          else navigate(location.state?.from || '/marketplace', { replace: true })
        }}
        onError={(err) => setError(err.message)}
      />
      <div className="my-5 flex items-center gap-3 text-[12.5px] text-ink-faint">
        <span className="h-px flex-1 bg-line" />or log in with email<span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit}>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" className="field-input mb-4" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@medhaviskillsuniversity.edu.in" />

        <div className="flex items-center justify-between">
          <label className="field-label" htmlFor="password">Password</label>
          <Link to="/forgot-password" state={{ email }} className="mb-1.5 text-[13px] font-semibold text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />

        {error && (
          <div className="mt-3 text-[13px]">
            <p className="text-coral">{error}</p>
            <p className="mt-1 text-ink-soft">
              Joined before passwords were added? Use{' '}
              <Link to="/forgot-password" state={{ email }} className="font-semibold text-brand hover:underline">Forgot password</Link>{' '}
              to create one.
            </p>
          </div>
        )}
        <button className="btn-primary mt-5 w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>

      <p className="mt-5 flex gap-2 rounded-xl bg-brand-tint px-3.5 py-3 text-[13px] text-brand-deep">
        🔒 CampusMarket is only available to verified students from approved institutional domains.
      </p>

      <p className="mt-5 text-center text-[13.5px] text-ink-soft">
        New here? <Link to="/signup" state={{ email }} className="font-semibold text-brand">Join your campus</Link>
      </p>
    </div>
  )
}
