import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Modal from './Modal.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { listingsApi } from '../services/api.js'
import { CategoryArt } from './CategoryTile.jsx'

// Pages where a pop-up would get in the way.
const SKIP = ['/onboarding', '/login', '/signup', '/forgot-password']

const daysSince = (iso) =>
  Math.max(1, Math.floor((Date.now() - new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()) / 86400000))

// "Is it sold?" for a seller's listings that have been up a week (GET /listings/sold-check), one
// at a time, so sold items don't stay on the marketplace because someone forgot to mark them.
// "Yes" marks it sold; "No" means it's asked again in another week. Closing it (× / Escape)
// just hides it until the next visit.
export default function SoldCheckPrompt() {
  const { user, isSeller, needsPassword, noteSale } = useAuth()
  const { pathname } = useLocation()
  const toast = useToast()
  const [queue, setQueue] = useState([])
  const [busy, setBusy] = useState(false)

  // After the password and phone prompts (SetPasswordModal, PhonePrompt) if those are needed.
  const ready = Boolean(user?.verified && isSeller && !needsPassword && user.profile_completed && user.phone)

  useEffect(() => {
    if (!ready) return
    listingsApi.soldCheck().then(setQueue).catch(() => {})
  }, [ready, user?.id])

  const listing = queue[0]
  if (!ready || !listing || SKIP.includes(pathname)) return null

  const next = () => setQueue((q) => q.slice(1))

  async function answer(sold) {
    setBusy(true)
    try {
      if (sold) {
        await listingsApi.setStatus(listing.id, 'sold')
        noteSale()
        toast(`“${listing.title}” marked as sold`)
      } else {
        await listingsApi.stillAvailable(listing.id)
        toast("Got it, we'll check again in a week")
      }
      next()
    } catch (err) {
      toast(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const thumb = listing.thumbnail || listing.images?.[0]
  return (
    <Modal open onClose={() => !busy && setQueue([])} title="Is this still for sale?">
      <div className="mb-4 flex items-center gap-3 rounded-control border border-line p-2">
        <span
          className="block h-14 w-14 flex-none overflow-hidden rounded-control">
          <CategoryArt category={listing.category} src={thumb} iconSize={24} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{listing.title}</p>
          <p className="text-sm text-ink-soft">Listed {daysSince(listing.created_at)} days ago</p>
        </div>
      </div>
      <p className="mb-5 text-[14px] text-ink-soft">
        Has it been sold? Marking it sold stops students from messaging you about something that's gone.
      </p>
      <div className="flex flex-wrap gap-4">
        <button className="btn-ghost flex-1 whitespace-nowrap" disabled={busy} onClick={() => answer(false)}>No, still available</button>
        <button className="btn-accent flex-1 whitespace-nowrap" disabled={busy} onClick={() => answer(true)}>Yes, it's sold</button>
      </div>
      {queue.length > 1 && <p className="mt-3 text-center text-[12px] text-ink-faint">{queue.length - 1} more to check after this</p>}
    </Modal>
  )
}
