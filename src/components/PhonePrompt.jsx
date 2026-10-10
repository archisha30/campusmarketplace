import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Modal from './Modal.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { cleanIndianMobile } from '../lib/format.js'

// Pages where the prompt would get in the way (onboarding already asks for the number).
const SKIP = ['/onboarding', '/login', '/signup']

// Accounts created before the WhatsApp number was required: ask once they're logged in,
// on any page, until they add one. "Contact Seller" opens a chat with this number.
export default function PhonePrompt() {
  const { user, isVerified, updateProfile, logout } = useAuth()
  const { pathname } = useLocation()
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const needed = Boolean(user && isVerified && user.profile_completed && !user.phone)
  if (!needed || SKIP.includes(pathname)) return null

  async function save(e) {
    e.preventDefault()
    const digits = cleanIndianMobile(phone)
    if (!digits) {
      setError('Enter a valid 10-digit WhatsApp number')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateProfile({ phone: digits })
      toast('Thanks! Your profile is complete.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    // Not dismissible: the setup isn't complete without a number. Logging out is the way out.
    <Modal open onClose={() => {}} title="Add your WhatsApp number">
      <p className="mb-4 text-[13.5px] text-ink-soft">
        One last step to finish setting up. When someone taps <span className="font-semibold text-ink">Contact Seller</span> on
        your items, WhatsApp opens a chat with this number.
      </p>
      <form onSubmit={save}>
        <label className="field-label" htmlFor="prompt-phone">WhatsApp number</label>
        <div className="flex">
          <span className="flex items-center rounded-l-[11px] border-[1.5px] border-r-0 border-line bg-bg px-3 text-[14px] text-ink-soft">+91</span>
          <input
            id="prompt-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            maxLength={14}
            className="field-input rounded-l-none"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
          />
        </div>
        {error && <p className="mt-2 text-[13px] text-coral">{error}</p>}
        <button className="btn-primary mt-4 w-full" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
      </form>
      <button type="button" onClick={() => logout()} className="mt-3 w-full text-center text-[12.5px] text-ink-faint hover:text-ink">
        Log out
      </button>
    </Modal>
  )
}
