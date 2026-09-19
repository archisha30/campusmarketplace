import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.signup(email)
      setSent(true)
      setTimeout(() => navigate('/onboarding'), 900)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[420px] rounded-slab border border-line bg-paper p-8 md:p-10">
      <h2 className="mb-2 text-[26px] font-bold">Join your campus</h2>
      <p className="mb-6 text-sm text-ink-soft">Sign up with your college email to get verified.</p>

      <form onSubmit={submit}>
        <label className="field-label" htmlFor="email">College email</label>
        <input id="email" type="email" required className="field-input mb-4" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
        {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || sent}>
          {sent ? 'Link sent — check your inbox' : busy ? 'Sending…' : 'Send OTP / Magic Link'}
        </button>
      </form>

      <p className="mt-5 flex gap-2 rounded-xl bg-brand-tint px-3.5 py-3 text-[13px] text-brand-deep">
        🔒 Only approved institutional domains can sign up. Try polaris.edu or northgate.edu in the demo.
      </p>

      <p className="mt-5 text-center text-[13.5px] text-ink-soft">
        Already verified? <Link to="/login" className="font-semibold text-brand">Log in</Link>
      </p>
    </div>
  )
}
