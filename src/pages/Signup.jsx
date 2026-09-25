import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Signup() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState('email') // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.signup(email)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, otp)
      navigate('/onboarding')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[420px] rounded-slab border border-line bg-paper p-8 md:p-10">
      {step === 'email' ? (
        <>
          <h2 className="mb-2 text-[26px] font-bold">Join your campus</h2>
          <p className="mb-6 text-sm text-ink-soft">Sign up with your college email to get verified.</p>

          <form onSubmit={sendCode}>
            <label className="field-label" htmlFor="email">College email</label>
            <input id="email" type="email" required className="field-input mb-4" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
            {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send verification code'}
            </button>
          </form>
        </>
      ) : (
        <>
          <h2 className="mb-2 text-[26px] font-bold">Check your inbox</h2>
          <p className="mb-6 text-sm text-ink-soft">Enter the 6-digit code we sent to {email}.</p>

          <form onSubmit={verifyCode}>
            <label className="field-label" htmlFor="otp">Verification code</label>
            <input id="otp" type="text" inputMode="numeric" maxLength={6} required
              className="field-input mb-4" value={otp}
              onChange={(e) => setOtp(e.target.value)} placeholder="123456" />
            {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
          </form>

          <button className="btn-ghost mt-3 w-full" onClick={() => setStep('email')}>
            Use a different email
          </button>
        </>
      )}

      <p className="mt-5 flex gap-2 rounded-xl bg-brand-tint px-3.5 py-3 text-[13px] text-brand-deep">
        🔒 Only approved institutional domains can sign up.
      </p>

      <p className="mt-5 text-center text-[13.5px] text-ink-soft">
        Already verified? <Link to="/login" className="font-semibold text-brand">Log in</Link>
      </p>
    </div>
  )
}