import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { draftsApi, listingsApi, resourcesApi, trashApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { SkeletonRows } from '../components/SkeletonCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import NotificationsPanel from '../components/NotificationsPanel.jsx'
import { useRequestNotifications } from '../hooks/useRequestNotifications.js'
import { openContact } from '../lib/contact.js'
import { formatPrice, isExpired, titleCase, timeAgo } from '../lib/format.js'

// "Deletes for good in 5h" / "in 40m", counting down to the end of the 24-hour window.
function timeLeft(iso) {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
  if (mins >= 60) return `Deletes for good in ${Math.floor(mins / 60)}h`
  return `Deletes for good in ${Math.max(1, mins)}m`
}

const TABS = [
  { label: 'Active', status: 'available' },
  { label: 'Reserved', status: 'reserved' },
  { label: 'Sold', status: 'sold' },
  { label: 'Drafts', status: 'drafts' }, // saved from Sell / Post a Resource
  { label: 'Deleted', status: 'deleted' }, // restorable for 24 hours
]

// Where "Continue" takes a draft, and how its row looks.
const DRAFT_KINDS = {
  listing: { path: '/sell', emoji: '📦', bg: '#FFF3D6', label: 'listing' },
  resource: { path: '/resources/new', emoji: '📚', bg: '#EEF0FF', label: 'resource' },
}

function draftPrice(d) {
  const { price, listing_type: listingType, offer_type: offerType } = d.data
  if (listingType === 'free' || offerType === 'free') return 'Free'
  return price !== undefined && price !== '' && !Number.isNaN(Number(price)) ? formatPrice(Number(price)) : 'No price yet'
}

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  // The tab lives in the URL (/dashboard?tab=drafts), so links and refreshes land on it.
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.status === params.get('tab')) || TABS[0]
  const setTab = (t) => setParams(t === TABS[0] ? {} : { tab: t.status }, { replace: true })
  const [confirmDelete, setConfirmDelete] = useState(null) // listing waiting for "Yes, delete"
  const [deleting, setDeleting] = useState(false)
  const [confirmDraft, setConfirmDraft] = useState(null) // draft waiting for "Yes, delete"

  const showingTrash = tab.status === 'deleted'
  const showingDrafts = tab.status === 'drafts'
  const { data, loading, refetch } = useApi(
    () => {
      if (showingTrash) return trashApi.list()
      if (showingDrafts) return draftsApi.list().then((drafts) => ({ drafts }))
      return listingsApi.list({ seller_id: user?.id, status: tab.status, include_sold: true })
    },
    [user?.id, tab.status]
  )
  // Right after switching tabs, `data` still holds the previous tab's response for one
  // render (listings come as { items }, drafts as { drafts }, the trash as a plain array),
  // so check the shape.
  const items = !showingTrash && !showingDrafts && Array.isArray(data?.items) ? data.items : []
  const trashed = showingTrash && Array.isArray(data) ? data : []
  const drafts = showingDrafts && Array.isArray(data?.drafts) ? data.drafts : []

  async function removeDraft() {
    setDeleting(true)
    try {
      await draftsApi.remove(confirmDraft.id)
      toast('Draft deleted')
      setConfirmDraft(null)
      refetch()
    } catch (err) {
      toast(err.message || "Couldn't delete the draft")
    } finally {
      setDeleting(false)
    }
  }

  async function restore(t) {
    try {
      await (t.type === 'listing' ? listingsApi.restore(t.id) : resourcesApi.restore(t.id))
      toast(`Restored "${t.title}"`)
      refetch()
    } catch (err) {
      toast(err.message || "Couldn't restore it")
      refetch()
    }
  }

  async function changeStatus(id, status) {
    await listingsApi.setStatus(id, status)
    toast(status === 'available' ? 'Listing is available again' : `Marked ${status}`)
    refetch()
  }

  async function remove() {
    setDeleting(true)
    try {
      await listingsApi.remove(confirmDelete.id)
      toast('Listing deleted. You can restore it from the Deleted tab for 24 hours')
      setConfirmDelete(null)
      refetch()
    } catch (err) {
      toast(err.message || "Couldn't delete the listing")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold">Seller Dashboard</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-soft">Your notifications, what students are looking for, and your listings, all in one place.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/sell" className="btn-accent btn-sm">+ Sell an Item</Link>
          <Link to="/resources/new" className="btn-ghost btn-sm">+ Post a Resource</Link>
        </div>
      </div>

      <NotificationsPanel
        blurb="Access requests, students reaching out, reports on your items, and updates from the CampusMarket team"
        empty="Nothing yet. You'll see it here when someone requests access or contacts you about a listing or resource."
      />
      <BuyerRequests />

      <h1 className="mb-6 text-[30px] font-bold">My Listings</h1>

      <div className="mb-6 flex border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t)}
            aria-current={tab.label === t.label}
            className={`-mb-px mr-6 border-b-[2.5px] pb-3 pt-3 text-[14.5px] font-semibold ${
              tab.label === t.label ? 'border-brand text-ink' : 'border-transparent text-ink-faint'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonRows />}

      {!showingTrash && !showingDrafts && !loading && items.length === 0 && (
        <EmptyState
          emoji="📭"
          title="Nothing here yet"
          body="Be the first person to list something on your campus."
          actionLabel="Sell an Item"
          actionTo="/sell"
        />
      )}

      {showingDrafts && !loading && drafts.length === 0 && (
        <p className="rounded-card bg-paper px-4 py-8 text-center text-[14px] text-ink-soft">
          No drafts. Use <strong className="text-ink">Save Draft</strong> when selling an item or posting a resource, and finish it later from here.
        </p>
      )}

      {showingDrafts && !loading && drafts.map((d) => {
        const k = DRAFT_KINDS[d.kind] || DRAFT_KINDS.listing
        const title = String(d.data.title || '').trim()
        return (
          <div key={d.id} className="mb-3 flex flex-wrap items-center gap-4 rounded-card border border-line bg-paper p-3.5">
            <div className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[10px] text-[26px]" style={{ background: k.bg }}>
              {k.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
                <span className={`break-words ${title ? '' : 'italic text-ink-faint'}`}>{title || 'Untitled draft'}</span>
                <span className="rounded-pill bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{k.label}</span>
              </p>
              <p className="text-[13px] text-ink-soft">{draftPrice(d)} · Saved {timeAgo(d.updated_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-accent btn-sm" onClick={() => navigate(`${k.path}?draft=${d.id}`)}>Continue</button>
              <button className="btn-danger btn-sm" onClick={() => setConfirmDraft(d)}>Delete</button>
            </div>
          </div>
        )
      })}

      {showingTrash && !loading && trashed.length === 0 && (
        <p className="rounded-card bg-paper px-4 py-8 text-center text-[14px] text-ink-soft">
          Nothing here. Listings and resources you delete stay here for 24 hours, so you can restore them.
        </p>
      )}

      {showingTrash && !loading && trashed.map((t) => (
        <div key={`${t.type}-${t.id}`} className="mb-3 flex flex-wrap items-center gap-4 rounded-card border border-dashed border-line bg-paper p-3.5">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-[10px] text-[26px] opacity-70" style={{ background: t.bg }}>
            {t.image ? <img src={t.image} alt="" className="h-full w-full object-cover" /> : t.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
              {t.title}
              <span className="rounded-pill bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{t.type}</span>
            </p>
            <p className="text-[13px] text-ink-soft">
              Deleted {timeAgo(t.deleted_at)} · <span className="font-semibold text-coral">{timeLeft(t.restore_until)}</span>
            </p>
          </div>
          <button className="btn-accent btn-sm" onClick={() => restore(t)}>Restore</button>
        </div>
      ))}

      {!loading && items.map((l) => (
        <div key={l.id} className="mb-3 flex flex-wrap items-center gap-4 rounded-card border border-line bg-paper p-3.5">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-[10px] text-[26px]" style={{ background: l.art.bg }}>
            {l.images?.length > 0 ? (
              <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" />
            ) : (
              l.art.emoji
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">{l.title}</p>
            <p className="text-[13px] text-ink-soft">
              {formatPrice(l.price)} · {titleCase(l.status)}
              {isExpired(l) && <span className="ml-1.5 font-semibold text-coral">· Expired, hidden from the marketplace</span>}
              {l.held && <span className="ml-1.5 font-semibold text-coral">· Held for review, hidden until our team checks the reports</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => navigate(`/sell/${l.id}/edit`)}>Edit</button>
            {l.status !== 'available' && (
              <button className="btn-ghost btn-sm" onClick={() => changeStatus(l.id, 'available')}>
                {l.status === 'sold' ? 'Relist as Available' : 'Mark Available'}
              </button>
            )}
            {l.status === 'available' && (
              <button className="btn-ghost btn-sm" onClick={() => changeStatus(l.id, 'reserved')}>Mark Reserved</button>
            )}
            {l.status !== 'sold' && (
              <button className="btn-ghost btn-sm" onClick={() => changeStatus(l.id, 'sold')}>Mark Sold</button>
            )}
            <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(l)}>Delete</button>
          </div>
        </div>
      ))}

      <Modal open={Boolean(confirmDelete)} onClose={() => !deleting && setConfirmDelete(null)} title="Delete this listing?">
        {confirmDelete && (
          <>
            <p className="text-[14px] text-ink-soft">
              Are you sure you want to delete <strong className="text-ink">"{confirmDelete.title}"</strong>? You can restore it from the <strong className="text-ink">Deleted</strong> tab for 24 hours, then it's gone for good.
            </p>
            {confirmDelete.status !== 'sold' && (
              <p className="mt-3 rounded-[10px] bg-brand-tint px-3 py-2 text-[12.5px] text-brand-deep">
                Sold it? Use <strong>Mark Sold</strong> instead, so it stays on the marketplace as sold.
              </p>
            )}
            <div className="mt-5 flex gap-2.5">
              <button className="btn-ghost flex-1" onClick={() => setConfirmDelete(null)} disabled={deleting} autoFocus>Cancel</button>
              <button className="btn-danger flex-1" onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, delete'}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={Boolean(confirmDraft)} onClose={() => !deleting && setConfirmDraft(null)} title="Delete this draft?">
        {confirmDraft && (
          <>
            <p className="text-[14px] text-ink-soft">
              Are you sure you want to delete the draft <strong className="text-ink">"{String(confirmDraft.data.title || '').trim() || 'Untitled draft'}"</strong>? Drafts can't be restored.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button className="btn-ghost flex-1" onClick={() => setConfirmDraft(null)} disabled={deleting} autoFocus>Cancel</button>
              <button className="btn-danger flex-1" onClick={removeDraft} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, delete'}</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function BuyerRequests() {
  const { items, loading, unread, isNew, markAllSeen } = useRequestNotifications({ freeze: true })
  const [showAll, setShowAll] = useState(false)

  // Opening the dashboard clears the navbar badge; the "New" markers here
  // stay until the seller leaves, since this list keeps its mount-time snapshot.
  useEffect(() => {
    if (!loading) markAllSeen()
  }, [loading, markAllSeen])

  const shown = showAll ? items : items.slice(0, 5)

  return (
    <section id="requests" className="mb-10 scroll-mt-24 rounded-slab border border-line bg-paper p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold">
          Buyer requests
          {unread > 0 && (
            <span className="rounded-pill bg-coral px-2 py-0.5 text-[11.5px] font-bold text-white">{unread} new</span>
          )}
        </h2>
        <p className="text-[13px] text-ink-faint">Students looking for something you might have</p>
      </div>

      {loading && <div className="skeleton h-20" />}

      {!loading && items.length === 0 && (
        <p className="rounded-card bg-bg px-4 py-6 text-center text-[14px] text-ink-soft">
          No requests right now. You'll see them here when students post one.
        </p>
      )}

      {!loading && shown.map((r) => <RequestRow key={r.id} r={r} fresh={isNew(r)} />)}

      {!loading && items.length > 5 && (
        <button className="mt-2 text-[13.5px] font-semibold text-brand hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${items.length} requests`}
        </button>
      )}
    </section>
  )
}

function RequestRow({ r, fresh }) {
  const { requester } = r
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const channel = requester.has_phone ? 'whatsapp' : 'email'

  // The requester's number/email isn't in the feed; it's fetched only when Reply is tapped.
  async function reply() {
    setBusy(true)
    try {
      await openContact({
        targetType: 'request',
        targetId: r.id,
        channel,
        subject: `CampusMarket — ${r.product}`,
        message: `Hi ${requester.name}! I saw your request for "${r.product}" on CampusMarket. I might have it.`,
      })
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`mb-2.5 flex items-start gap-3.5 rounded-card border p-3.5 ${fresh ? 'border-brand/30 bg-brand-tint/50' : 'border-line'}`}>
      <Avatar user={requester} size={38} className="bg-sun font-display text-ink" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-soft">
          <span className="font-semibold text-ink">{requester.name}</span> is looking for
          <span className="ml-2 text-ink-faint">· {timeAgo(r.created_at)}</span>
          {fresh && <span className="ml-2 rounded-pill bg-brand px-1.5 py-px text-[10.5px] font-bold text-white">New</span>}
        </p>
        <p className="mt-0.5 break-words text-[15px] font-semibold">{r.product}</p>
        {r.description && <p className="mt-0.5 break-words text-[13.5px] text-ink-soft">{r.description}</p>}
      </div>
      <button className="btn-ghost btn-sm flex-none" disabled={busy} onClick={reply}>
        {requester.has_phone ? 'Reply on WhatsApp' : 'Reply by Email'}
      </button>
    </div>
  )
}
