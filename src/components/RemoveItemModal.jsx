import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

const REASONS = [
  'Scam or fake listing',
  'Prohibited item',
  'Misleading price or details',
  'Spam or duplicate',
  'Inappropriate photos or text',
]

// Admin moderation: removing someone's listing or resource needs a reason, which is sent to
// the seller in their notification so they know what went wrong.
// `item` = { kind: 'listing' | 'resource', title }; `onRemove(reason)` does the removal.
export default function RemoveItemModal({ item, onRemove, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = Boolean(item)
  useEffect(() => { if (open) { setReason(''); setError('') } }, [open]) // fresh each time it opens

  async function submit() {
    if (reason.trim().length < 3) {
      setError('Write a reason for the seller, or pick one above.')
      return
    }
    setBusy(true)
    try {
      await onRemove(reason.trim())
    } catch (err) {
      setError(err.message || "Couldn't remove it")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={`Remove this ${item?.kind || 'item'}?`}>
      {item && (
        <>
          <p className="text-[14px] text-ink-soft">
            <strong className="break-words text-ink">“{item.title}”</strong> will be deleted for good, and its open reports resolved.
            The seller gets a notification with the reason you give.
          </p>
          <label className="field-label mt-4" htmlFor="remove-reason">Reason (the seller sees this)</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => { setReason(r); setError('') }}
                className={`rounded-pill border px-2.5 py-1 text-[12px] ${reason === r ? 'border-brand bg-brand-tint text-brand' : 'border-line text-ink-soft'}`}>
                {r}
              </button>
            ))}
          </div>
          <textarea id="remove-reason" rows={2} maxLength={300} className="field-input resize-y" aria-invalid={Boolean(error)}
            value={reason} onChange={(e) => { setReason(e.target.value); setError('') }}
            placeholder="e.g. Selling notes copied from a paid course" />
          {error && <p className="mt-1.5 text-[13px] text-coral">{error}</p>}
          <div className="mt-5 flex gap-2.5">
            <button className="btn-ghost flex-1" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-danger flex-1" onClick={submit} disabled={busy}>{busy ? 'Removing…' : 'Remove'}</button>
          </div>
        </>
      )}
    </Modal>
  )
}
