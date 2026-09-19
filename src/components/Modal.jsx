import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/45 p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-slab bg-paper p-7">
        <h3 className="mb-4 text-[19px] font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  )
}
