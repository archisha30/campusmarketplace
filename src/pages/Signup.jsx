import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { trackEvent } from '../lib/analytics.js'
import { PASSWORD_HINT, newPasswordErrors } from '../lib/password.js'
import PasswordInput from '../components/PasswordInput.jsx'
import GoogleButton from '../components/GoogleButton.jsx'

const ACCOUNT_TYPES = [
  { value: 'buyer', emoji: '🛍️', title: 'Buyer', body: 'Browse and buy from students on your campus.' },
  { value: 'seller', emoji: '🏷️', title: 'Seller', body: 'List your own items, and buy too.' },
]

function FieldError({ msg }) {
  return msg ? <p className="mt-1.5 text-[13px] text-coral">{msg}</p> : null
}

// Step 1: account type, college email and password. Step 2: the emailed code proves the
// email; only then is the account created with that password.
export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signupVerify } = useAuth()
  const [step, setStep] = useState('details') // 'details' | 'otp'
  const [email, setEmail] = useState(location.state?.email || '')
  const [accountType, setAccountType] = useState('buyer')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e) {
    e.preventDefault()
    setError('')
    const problems = newPasswordErrors(password, confirm)
    setFieldErrors(problems)
    if (Object.keys(problems).length) return
    setBusy(true)
    try {
      await authApi.signup(email, accountType)
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
      await signupVerify({ email, otp, account_type: accountType, password, confirm_password: confirm })
      trackEvent('sign_up', { method: 'password', account_type: accountType })
      navigate('/onboarding')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[420px] rounded-slab border border-line bg-paper p-8 md:p-10">
      {step === 'details' ? (
        <>
          <h2 className="mb-2 text-[26px] font-bold">Join your campus</h2>
          <p className="mb-6 text-sm text-ink-soft">Sign up with your college email to get verified.</p>

          <form onSubmit={sendCode} noValidate>
            <fieldset className="mb-5">
              <legend className="field-label">I want to join as a</legend>
              <div className="grid grid-cols-2 gap-3">
                {ACCOUNT_TYPES.map((t) => {
                  const active = accountType === t.value
                  return (
                    <label
                      key={t.value}
                      className={`cursor-pointer rounded-card border-[1.5px] p-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                        active ? 'border-brand bg-brand-tint' : 'border-line hover:border-ink-faint'
                      }`}
                    >
                      <input
                        type="radio"
                        name="account_type"
                        value={t.value}
                        checked={active}
                        onChange={() => setAccountType(t.value)}
                        className="sr-only"
                      />
                      <span className="mb-1 block text-[22px]" aria-hidden>{t.emoji}</span>
                      <span className="block text-[15px] font-semibold">{t.title}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">{t.body}</span>
                    </label>
                  )
                })}
              </div>
              {/* Friendly hint, not a warning: many students want to buy AND sell. */}
              <p
                key={accountType}
                aria-live="polite"
                className="mt-2.5 flex items-start gap-2 rounded-[10px] bg-brand-tint px-3 py-2 text-[12.5px] leading-snug text-brand-deep motion-safe:animate-[fadeIn_.2s_ease-out]"
              >
                <span aria-hidden>{accountType === 'buyer' ? '💡' : '✨'}</span>
                {accountType === 'buyer' ? (
                  <span>Want to sell too? Switch to <strong>Seller</strong> anytime from your Profile.</span>
                ) : (
                  <span>Sellers can <strong>buy too</strong>, so you get both.</span>
                )}
              </p>
            </fieldset>

            {/* One tap with the college Google account: no typing the email, no code. */}
            <GoogleButton
              text="signup_with"
              accountType={accountType}
              onSuccess={({ user, created }) => {
                trackEvent(created ? 'sign_up' : 'login', { method: 'google', account_type: accountType })
                navigate(user.profile_completed ? '/marketplace' : '/onboarding')
              }}
              onError={(err) => setError(err.message)}
            />
            <div className="my-5 flex items-center gap-3 text-[12.5px] text-ink-faint">
              <span className="h-px flex-1 bg-line" />or sign up with email<span className="h-px flex-1 bg-line" />
            </div>

            <label className="field-label" htmlFor="email">College email</label>
            <input id="email" type="email" required autoComplete="email" className="field-input mb-4" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="Your college email" />

            <label className="field-label" htmlFor="password">Create password</label>
            <PasswordInput id="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" />
            {fieldErrors.password
              ? <FieldError msg={fieldErrors.password} />
              : <p className="mt-1.5 text-[12.5px] text-ink-faint">{PASSWORD_HINT}</p>}

            <label className="field-label mt-4" htmlFor="confirm">Confirm password</label>
            <PasswordInput id="confirm" required autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" />
            <FieldError msg={fieldErrors.confirm} />

            {error && <p className="mt-4 text-[13px] text-coral">{error}</p>}
            <button className="btn-primary mt-5 w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send verification code'}
            </button>
          </form>
        </>
      ) : (
        <>
          <h2 className="mb-2 text-[26px] font-bold">Check your inbox</h2>
          <p className="mb-6 text-sm text-ink-soft">
            Enter the 6-digit code we sent to {email}. Your account is created once it's verified.
            (If this email already has an account, we've emailed you instead. Just <Link to="/login" className="font-semibold text-brand">log in</Link>.)
          </p>

          <form onSubmit={verifyCode}>
            <label className="field-label" htmlFor="otp">Verification code</label>
            <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
              className="field-input mb-4" value={otp}
              onChange={(e) => setOtp(e.target.value)} placeholder="123456" />
            {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify & create account'}
            </button>
          </form>

          <button className="btn-ghost mt-3 w-full" onClick={() => { setStep('details'); setOtp(''); setError('') }}>
            Change email or password
          </button>
        </>
      )}

      <p className="mt-5 flex gap-2 rounded-xl bg-brand-tint px-3.5 py-3 text-[13px] text-brand-deep">
        🔒 Only approved institutional domains can sign up.
      </p>

      <p className="mt-3 text-center text-[12px] text-ink-faint">
        By signing up you agree to our{' '}
        <Link to="/terms" className="font-semibold text-ink-soft hover:underline">Terms</Link> and{' '}
        <Link to="/privacy" className="font-semibold text-ink-soft hover:underline">Privacy Policy</Link>.
      </p>

      <p className="mt-5 text-center text-[13.5px] text-ink-soft">
        Already have an account? <Link to="/login" className="font-semibold text-brand">Log in</Link>
      </p>
    </div>
  )
}
