import { useState } from 'react'
import { CategoryLabel } from './CategoryTile.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { timeAgo } from '../lib/format.js'
import { parseDetails, replyToRequest } from '../lib/requests.js'

// One request on the "Looking for something?" page. With `canReply`, a seller can message the student.
export default function RequestCard({ r, canReply = false }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const d = parseDetails(r.description)

  async function reply() {
    setBusy(true)
    try {
      await replyToRequest(r)
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex items-start gap-4 p-6">
      <div className="min-w-0 flex-1">
        {d.category && <CategoryLabel category={d.category} className="mb-2" />}
        <p className="break-words text-[17px] font-semibold leading-snug">{r.product}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {[d.neededBy, canReply && r.requester?.name, timeAgo(r.created_at), r.found && 'Found'].filter(Boolean).join(' · ')}
        </p>
        {d.note && <p className="mt-2 break-words text-sm leading-relaxed text-ink-soft">{d.note}</p>}
      </div>
      <div className="flex flex-none flex-col items-end gap-2">
        {d.budget && <p className="hd text-lg leading-tight">≤ ₹{d.budget}</p>}
        {canReply && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={busy}
            onClick={reply}
            aria-label={`I have this: message ${r.requester?.name} about ${r.product} on ${r.requester?.has_phone ? 'WhatsApp' : 'email'}`}
          >
            I have this
          </button>
        )}
      </div>
    </div>
  )
}
