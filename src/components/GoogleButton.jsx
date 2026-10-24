import { useEffect, useRef, useState } from 'react'
import { IS_MOCK } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'

// Google's own button script, loaded once and only on pages that show the button.
let gisLoading = null
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = GIS_SCRIPT
      s.async = true
      s.defer = true
      s.onload = resolve
      s.onerror = () => {
        gisLoading = null
        reject(new Error("Couldn't load Google sign-in. Check your connection and try again."))
      }
      document.head.appendChild(s)
    })
  }
  return gisLoading
}

// "Continue with Google". Google hands us a signed token for the student's college account;
// the backend verifies it and logs them in (or creates the account with `accountType`, which
// only the Signup page passes; a new student on the Login page is asked to sign up first).
export default function GoogleButton({ accountType = null, text = 'continue_with', onSuccess, onError }) {
  const { googleSignIn } = useAuth()
  const holder = useRef(null)
  const latest = useRef({})
  latest.current = { accountType, onSuccess, onError, googleSignIn }
  const [busy, setBusy] = useState(false)

  async function finish(credential) {
    const { accountType: type, onSuccess: ok, onError: fail, googleSignIn: signIn } = latest.current
    setBusy(true)
    try {
      ok?.(await signIn(credential, type))
    } catch (err) {
      fail?.(err)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (IS_MOCK || !CLIENT_ID) return undefined
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: ({ credential }) => finish(credential),
          ux_mode: 'popup',
          context: text === 'signup_with' ? 'signup' : 'signin',
        })
        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, holder.current.offsetWidth || 320)),
        })
      })
      .catch((err) => latest.current.onError?.(err))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  if (IS_MOCK) {
    // Mock mode: no real Google; logs in as the sample account.
    return (
      <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => finish('mock-credential')}>
        <GoogleG /> {text === 'signup_with' ? 'Sign up with Google' : 'Continue with Google'} (mock)
      </button>
    )
  }
  if (!CLIENT_ID) return null
  return (
    <div className={`flex justify-center ${busy ? 'pointer-events-none opacity-60' : ''}`}>
      <div ref={holder} className="w-full max-w-[400px]" />
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
