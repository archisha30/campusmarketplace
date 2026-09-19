import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email)
      navigate(location.state?.from || '/marketplace', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[420px] rounded-slab border border-line bg-paper p-8 md:p-10">
      <h2 className="mb-2 text-[26px] font-bold">Welcome back</h2>
      <p className="mb-6 text-sm text-ink-soft">Log in with your verified college email.</p>

      <form onSubmit={submit}>
        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" type="email" required className="field-input mb-4" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
        {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[12.5px] text-ink-faint">
        <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
      </div>
      <button className="btn-ghost w-full" onClick={submit}>Continue with college email</button>

      <p className="mt-5 flex gap-2 rounded-xl bg-brand-tint px-3.5 py-3 text-[13px] text-brand-deep">
        🔒 CampusMarket is only available to verified students from approved institutional domains.
      </p>

      <p className="mt-5 text-center text-[13.5px] text-ink-soft">
        New here? <Link to="/signup" className="font-semibold text-brand">Join your campus</Link>
      </p>
    </div>
  )
}
