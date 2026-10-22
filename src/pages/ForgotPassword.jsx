import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { PASSWORD_HINT, newPasswordErrors } from '../lib/password.js'
import PasswordInput from '../components/PasswordInput.jsx'

// Email a reset code to the college inbox, then set a new password with it (and log in).
export default function ForgotPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const { resetPassword } = useAuth()
  const [step, setStep] = useState('email') // 'email' | 'reset'
  const [email, setEmail] = useState(location.state?.email || '')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.forgotPassword(email)
      setStep('reset')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function reset(e) {
    e.preventDefault()
    setError('')
    const problems = newPasswordErrors(password, confirm)
    setFieldErrors(problems)
    if (Object.keys(problems).length) return
    setBusy(true)
    try {
      const u = await resetPassword({ email, otp, password, confirm_password: confirm })
      navigate(u?.profile_completed === false ? '/onboarding' : '/marketplace', { replace: true })
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
          <h2 className="mb-2 text-[26px] font-bold">Forgot your password?</h2>
          <p className="mb-6 text-sm text-ink-soft">We'll email a code to your college inbox so you can set a new one.</p>
          <form onSubmit={sendCode}>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="field-input mb-4" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="Your college email" />
            {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
          </form>
        </>
      ) : (
        <>
          <h2 className="mb-2 text-[26px] font-bold">Set a new password</h2>
          <p className="mb-6 text-sm text-ink-soft">
            If {email} has an account, a 6-digit code is on its way. Check your spam folder too.
          </p>
          <form onSubmit={reset} noValidate>
            <label className="field-label" htmlFor="otp">Code</label>
            <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
              className="field-input mb-4" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" />

            <label className="field-label" htmlFor="password">New password</label>
            <PasswordInput id="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" />
            {fieldErrors.password
              ? <p className="mt-1.5 text-[13px] text-coral">{fieldErrors.password}</p>
              : <p className="mt-1.5 text-[12.5px] text-ink-faint">{PASSWORD_HINT}</p>}

            <label className="field-label mt-4" htmlFor="confirm">Confirm new password</label>
            <PasswordInput id="confirm" required autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" />
            {fieldErrors.confirm && <p className="mt-1.5 text-[13px] text-coral">{fieldErrors.confirm}</p>}

            {error && <p className="mt-4 text-[13px] text-coral">{error}</p>}
            <button className="btn-primary mt-5 w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password & log in'}</button>
          </form>
          <button className="btn-ghost mt-3 w-full" onClick={() => { setStep('email'); setOtp(''); setError('') }}>
            Send a new code
          </button>
        </>
      )}

      <p className="mt-5 text-center text-[13.5px] text-ink-soft">
        Remembered it? <Link to="/login" className="font-semibold text-brand">Log in</Link>
      </p>
    </div>
  )
}
