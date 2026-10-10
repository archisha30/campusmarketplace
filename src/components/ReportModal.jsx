import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { reportsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { REPORT_REASONS } from '../data/sample.js'
import { trackEvent } from '../lib/analytics.js'

const DETAILS_MAX = 300

// Reports go to the admins (with who reported) and notify the seller (anonymously).
export default function ReportModal({ open, onClose, targetTitle, listingId, resourceId }) {
  const toast = useToast()
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setReason(null)
      setDetails('')
    }
  }, [open])

  async function submit() {
    if (!reason) return
    setSubmitting(true)
    try {
      await reportsApi.create({ listing_id: listingId, resource_id: resourceId, reason, details: details.trim() || null })
      trackEvent('report_item', { item_type: listingId ? 'listing' : 'resource', reason })
      toast('Report submitted. Our team will review it.')
      onClose()
    } catch (err) {
      toast(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Report "${targetTitle}"`}>
      <p className="mb-3 text-[13px] text-ink-soft">
        What's wrong? The seller is told their item was reported, but not who reported it.
      </p>
      <div className="space-y-2" role="radiogroup" aria-label="Reason">
        {REPORT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            disabled={submitting}
            onClick={() => setReason(r)}
            className={`w-full rounded-[10px] border-[1.5px] px-3.5 py-3 text-left text-sm disabled:opacity-50 ${
              reason === r ? 'border-coral bg-coral/10 font-semibold text-coral' : 'border-line hover:border-coral'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {reason && (
        <div className="mt-3">
          <label className="field-label" htmlFor="report-details">
            Details <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <textarea
            id="report-details"
            rows={3}
            maxLength={DETAILS_MAX}
            className="field-input resize-none"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. Asked me to pay before meeting"
          />
        </div>
      )}

      <div className="mt-4 flex gap-2.5">
        <button onClick={onClose} className="btn-ghost flex-1" disabled={submitting}>Cancel</button>
        <button onClick={submit} className="btn flex-1 bg-coral text-white disabled:opacity-50" disabled={!reason || submitting}>
          {submitting ? 'Sending…' : 'Submit report'}
        </button>
      </div>
    </Modal>
  )
}
