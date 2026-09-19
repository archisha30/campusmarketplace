import { useState } from 'react'
import Modal from './Modal.jsx'
import { reportsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { REPORT_REASONS } from '../data/sample.js'

export default function ReportModal({ open, onClose, targetTitle, listingId, resourceId }) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  async function submit(reason) {
    setSubmitting(true)
    try {
      await reportsApi.create({ listing_id: listingId, resource_id: resourceId, reason })
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
      <div className="space-y-2">
        {REPORT_REASONS.map((r) => (
          <button
            key={r}
            disabled={submitting}
            onClick={() => submit(r)}
            className="w-full rounded-[10px] border-[1.5px] border-line px-3.5 py-3 text-left text-sm hover:border-coral disabled:opacity-50"
          >
            {r}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="btn-ghost mt-3 w-full">Cancel</button>
    </Modal>
  )
}
