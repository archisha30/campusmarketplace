import { useEffect, useRef, useState } from 'react'
import { useToast } from '../hooks/useToast.jsx'

// "Share" on a listing or resource: WhatsApp, copy link, or the phone's own share sheet
// (Instagram, Telegram, Messages…) where the browser has one. Recipients need to log in
// with their college email to open it, and land back on the item afterwards.
export default function ShareButton({ title, message, path, className = '' }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const url = `${window.location.origin}${path}`
  const text = `${message}\n${url}`
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function copy() {
    setOpen(false)
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      window.prompt('Copy this link', url) // clipboard blocked (e.g. http or an old browser)
    }
  }

  async function more() {
    setOpen(false)
    try {
      await navigator.share({ title, text: message, url })
    } catch {
      // closed the share sheet: nothing to do
    }
  }

  const item = 'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] hover:bg-bg'

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-line bg-paper px-3 py-1 text-[12.5px] font-semibold text-ink-soft transition hover:border-ink hover:text-ink"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Share
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-card border border-line bg-paper py-1 shadow-lg">
          <a
            role="menuitem"
            className={item}
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden>💬</span> WhatsApp
          </a>
          <button role="menuitem" type="button" className={item} onClick={copy}>
            <span aria-hidden>🔗</span> Copy link
          </button>
          {canNativeShare && (
            <button role="menuitem" type="button" className={item} onClick={more}>
              <span aria-hidden>📤</span> More apps…
            </button>
          )}
        </div>
      )}
    </div>
  )
}
