import { useEffect, useRef, useState } from 'react'
import { useToast } from '../hooks/useToast.jsx'
import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import WhatsAppIcon from './WhatsAppIcon.jsx'

// "Share" on a listing or resource: WhatsApp, copy link, or the phone's own share sheet
// (Instagram, Telegram, Messages…) where the browser has one. Recipients need to log in
// with their college email to open it, and land back on the item afterwards.
export default function ShareButton({ title, message, path, className = '' }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [manualCopy, setManualCopy] = useState(false) // clipboard blocked: show the link to copy by hand
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
      setManualCopy(true) // clipboard blocked (e.g. http or an old browser)
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

  const item = 'flex w-full items-center no-lift gap-2 px-4 py-3 text-left text-sm hover:bg-bg'

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="chip"
      >
        <Icon name="share-2" size={18} />
        Share
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-card border border-line bg-paper py-1">
          <a
            role="menuitem"
            className={item}
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <WhatsAppIcon size={18} className="text-whatsapp" /> WhatsApp
          </a>
          <button role="menuitem" type="button" className={item} onClick={copy}>
            <Icon name="link" size={18} /> Copy link
          </button>
          {canNativeShare && (
            <button role="menuitem" type="button" className={item} onClick={more}>
              <Icon name="share-2" size={18} /> More apps…
            </button>
          )}
        </div>
      )}
      <Modal open={manualCopy} onClose={() => setManualCopy(false)} title="Copy this link">
        <input readOnly value={url} className="field-input" aria-label="Link" onFocus={(e) => e.target.select()} autoFocus />
        <p className="mt-1.5 text-[12.5px] text-ink-faint">Your browser blocked copying. Select the link and copy it.</p>
        <button className="btn-ghost mt-4 w-full" onClick={() => setManualCopy(false)}>Done</button>
      </Modal>
    </div>
  )
}
