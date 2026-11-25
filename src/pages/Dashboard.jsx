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
import { replyToRequest } from '../lib/requests.js'
import { formatPrice, isExpired, titleCase, timeAgo } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { CategoryArt } from '../components/CategoryTile.jsx'

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
  { label: 'Resources', status: 'resources' }, // your Resource Hub items, open and closed
  { label: 'Drafts', status: 'drafts' }, // saved from Sell / Post a Resource
  { label: 'Deleted', status: 'deleted' }, // restorable for 24 hours
]

// Where "Continue" takes a draft, and how its row looks.
const DRAFT_KINDS = {
  listing: { path: '/sell', icon: 'package', label: 'listing' },
  resource: { path: '/resources/new', icon: 'book-open', label: 'resource' },
}

function draftPrice(d) {
  const { price, listing_type: listingType, offer_type: offerType } = d.data
  if (listingType === 'free' || offerType === 'free') return 'Free'
  return price !== undefined && price !== '' && !Number.isNaN(Number(price)) ? formatPrice(Number(price)) : 'No price yet'
}

export default function Dashboard() {
  const { user, noteSale } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  // The tab lives in the URL (/dashboard?tab=drafts), so links and refreshes land on it.
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.status === params.get('tab')) || TABS[0]
  const setTab = (t) => setParams(t === TABS[0] ? {} : { tab: t.status }, { replace: true })
  const [confirmDelete, setConfirmDelete] = useState(null) // { kind: 'listing' | 'resource', ...item } waiting for "Yes, delete"
  const [deleting, setDeleting] = useState(false)
  const [confirmDraft, setConfirmDraft] = useState(null) // draft waiting for "Yes, delete"

  const showingTrash = tab.status === 'deleted'
  const showingDrafts = tab.status === 'drafts'
  const showingResources = tab.status === 'resources'
  const showingListings = !showingTrash && !showingDrafts && !showingResources
  const { data, loading, refetch } = useApi(
    () => {
      if (showingTrash) return trashApi.list()
      if (showingDrafts) return draftsApi.list().then((drafts) => ({ drafts }))
      if (showingResources) return resourcesApi.list({ mine: true }).then((res) => ({ resources: res.items }))
      return listingsApi.list({ seller_id: user?.id, status: tab.status, include_sold: true })
    },
    [user?.id, tab.status]
  )
  // Right after switching tabs, `data` still holds the previous tab's response for one
  // render (listings come as { items }, resources as { resources }, drafts as { drafts }, the
  // trash as a plain array), so check the shape.
  const items = showingListings && Array.isArray(data?.items) ? data.items : []
  const myResources = showingResources && Array.isArray(data?.resources) ? data.resources : []
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
    if (status === 'sold') noteSale() // the account stays a seller from now on
    toast(status === 'available' ? 'Listing is available again' : `Marked ${status}`)
    refetch()
  }

  async function changeResourceStatus(r, status) {
    try {
      await resourcesApi.setStatus(r.id, status)
      toast(status === 'closed' ? `Closed "${r.title}". It's hidden from the Resource Hub` : `"${r.title}" is open again`)
      refetch()
    } catch (err) {
      toast(err.message || "Couldn't update the resource")
    }
  }

  async function remove() {
    const isResource = confirmDelete.kind === 'resource'
    setDeleting(true)
    try {
      await (isResource ? resourcesApi.remove(confirmDelete.id) : listingsApi.remove(confirmDelete.id))
      toast(`${isResource ? 'Resource' : 'Listing'} deleted. You can restore it from the Deleted tab for 24 hours`)
      setConfirmDelete(null)
      refetch()
    } catch (err) {
      toast(err.message || `Couldn't delete the ${isResource ? 'resource' : 'listing'}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="wrap py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Seller Dashboard</h1>
          <p className="mt-2 text-[17px] text-ink-soft">Your notifications, what students are looking for, and your listings and resources, all in one place.</p>
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

      <h1 className="mb-4 text-[32px] leading-tight">My Listings & Resources</h1>

      <div className="mb-6 flex overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t)}
            aria-current={tab.label === t.label}
            className={`-mb-px mr-6 shrink-0 border-b-[2.5px] pb-3 pt-3 text-[15px] font-semibold ${
              tab.label === t.label ? 'border-brand text-ink' : 'border-transparent text-ink-faint'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonRows />}

      {showingResources && !loading && myResources.length === 0 && (
        <EmptyState
          icon="book-open"
          title="No resources yet"
          body="Share notes, papers or books with students on your campus, free or for a price."
          actionLabel="Post a Resource"
          actionTo="/resources/new"
        />
      )}

      {showingResources && !loading && myResources.map((r) => (
        <div key={r.id} className="card mb-4 flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-control border border-line bg-bg text-[26px]">
            {r.thumbnail_url
              ? <img src={r.thumbnail_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
              : <Icon name={r.copy_type === 'hard' ? 'book-open' : 'file-text'} size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/resources/${r.id}`} className="text-[15px] font-semibold hover:underline">{r.title}</Link>
            <p className="text-sm text-ink-soft">
              {r.offer_type === 'free' ? 'Free' : formatPrice(r.price)} · {r.subject} · {r.status === 'closed' ? 'Closed' : 'Open'}
              {r.held && <span className="ml-1.5 font-semibold text-coral">· Held for review, hidden until our team checks the reports</span>}
            </p>
            {r.pending_requests > 0 && (
              <Link to={`/resources/${r.id}#manage`} className="mt-0.5 inline-block text-[13px] font-semibold text-brand hover:underline">
                {r.pending_requests} access request{r.pending_requests === 1 ? '' : 's'} waiting
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => navigate(`/resources/${r.id}/edit`)}>Edit</button>
            {r.status === 'closed'
              ? <button className="btn-ghost btn-sm" onClick={() => changeResourceStatus(r, 'available')}>Reopen</button>
              : <button className="btn-ghost btn-sm" onClick={() => changeResourceStatus(r, 'closed')}>Close</button>}
            <button className="btn-danger btn-sm" onClick={() => setConfirmDelete({ ...r, kind: 'resource' })}>Delete</button>
          </div>
        </div>
      ))}

      {showingListings && !loading && items.length === 0 && (
        <EmptyState
          icon="inbox"
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
          <div key={d.id} className="card mb-4 flex flex-wrap items-center gap-4 p-4">
            <div className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-control bg-bg"><Icon name={k.icon} size={24} /></div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                <span className={`break-words ${title ? '' : 'italic text-ink-faint'}`}>{title || 'Untitled draft'}</span>
                <span className="rounded-pill bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{k.label}</span>
              </p>
              <p className="text-sm text-ink-soft">{draftPrice(d)} · Saved {timeAgo(d.updated_at)}</p>
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
        <div key={`${t.type}-${t.id}`} className="card mb-4 flex flex-wrap items-center gap-4 border-dashed p-4">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-control bg-bg opacity-70">
            {t.image ? <img src={t.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Icon name={t.type === 'resource' ? 'book-open' : 'package'} size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
              {t.title}
              <span className="rounded-pill bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{t.type}</span>
            </p>
            <p className="text-sm text-ink-soft">
              Deleted {timeAgo(t.deleted_at)} · <span className="font-semibold text-coral">{timeLeft(t.restore_until)}</span>
            </p>
          </div>
          <button className="btn-accent btn-sm" onClick={() => restore(t)}>Restore</button>
        </div>
      ))}

      {!loading && items.map((l) => (
        <div key={l.id} className="card mb-4 flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-control">
            <CategoryArt category={l.category} src={l.images?.length > 0 ? l.thumbnail || l.images[0] : null} alt={l.title} iconSize={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{l.title}</p>
            <p className="text-sm text-ink-soft">
              {formatPrice(l.price)} · {titleCase(l.status)}
              {isExpired(l) && <span className="ml-1.5 font-semibold text-coral">· Expired, hidden from the marketplace</span>}
              {l.held && <span className="ml-1.5 font-semibold text-coral">· Held for review, hidden until our team checks the reports</span>}
            </p>
            <ListingStats l={l} />
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
            <button className="btn-danger btn-sm" onClick={() => setConfirmDelete({ ...l, kind: 'listing' })}>Delete</button>
          </div>
        </div>
      ))}

      <Modal open={Boolean(confirmDelete)} onClose={() => !deleting && setConfirmDelete(null)} title={`Delete this ${confirmDelete?.kind === 'resource' ? 'resource' : 'listing'}?`}>
        {confirmDelete && (
          <>
            <p className="text-[14px] text-ink-soft">
              Are you sure you want to delete <strong className="text-ink">"{confirmDelete.title}"</strong>? You can restore it from the <strong className="text-ink">Deleted</strong> tab for 24 hours, then it's gone for good.
            </p>
            {confirmDelete.kind === 'listing' && confirmDelete.status !== 'sold' && (
              <p className="mt-3 rounded-control bg-brand-tint px-3 py-2 text-[13px] text-brand-deep">
                Sold it? Use <strong>Mark Sold</strong> instead, so it stays on the marketplace as sold.
              </p>
            )}
            {confirmDelete.kind === 'resource' && confirmDelete.status !== 'closed' && (
              <p className="mt-3 rounded-control bg-brand-tint px-3 py-2 text-[13px] text-brand-deep">
                Just want to stop new requests? Use <strong>Close</strong> instead. Students you've already approved keep their access.
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
  const { items, loading, unread, isNew, markAllSeen, dismiss } = useRequestNotifications({ freeze: true })
  const [showAll, setShowAll] = useState(false)

  // Opening the dashboard clears the navbar badge; the "New" markers here
  // stay until the seller leaves, since this list keeps its mount-time snapshot.
  useEffect(() => {
    if (!loading) markAllSeen()
  }, [loading, markAllSeen])

  const shown = showAll ? items : items.slice(0, 5)

  return (
    <section id="requests" className="card mb-12 scroll-mt-24 p-6 md:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl">
          Buyer requests
          {unread > 0 && (
            <span className="rounded-lg bg-coral px-2 py-1 font-sans text-xs font-bold leading-none tracking-normal text-white">{unread} new</span>
          )}
        </h2>
        <p className="text-sm text-ink-soft">Got one of these? Message the student and make a quick sale.</p>
      </div>

      {loading && <div className="skeleton h-20" />}

      {!loading && items.length === 0 && (
        <p className="rounded-card bg-bg px-4 py-6 text-center text-[14px] text-ink-soft">
          No requests right now. You'll see them here when students post one.
        </p>
      )}

      {!loading && shown.map((r) => <RequestRow key={r.id} r={r} fresh={isNew(r)} onDismiss={() => dismiss(r.id)} />)}

      {!loading && items.length > 5 && (
        <button className="mt-2 text-sm font-semibold text-brand hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${items.length} requests`}
        </button>
      )}
    </section>
  )
}

function RequestRow({ r, fresh, onDismiss }) {
  const { requester } = r
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function dismiss() {
    try {
      await onDismiss()
      toast('Request dismissed')
    } catch (err) {
      toast(err.message || 'Could not dismiss the request')
    }
  }

  // The requester's number/email isn't in the feed; it's fetched only when Reply is tapped.
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
    <div className={`mb-4 flex flex-wrap items-start gap-4 rounded-card border p-4 sm:flex-nowrap md:p-6 ${fresh ? 'border-brand/30 bg-brand-tint' : 'border-line bg-paper'}`}>
      <Avatar user={requester} size={44} className="bg-[#FFE4CF] font-display text-ink" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{requester.name}</span> is looking for
          <span className="ml-2 text-ink-faint">· {timeAgo(r.created_at)}</span>
          {fresh && <span className="ml-2 rounded-pill bg-brand px-1.5 py-px text-[10.5px] font-bold text-white">New</span>}
        </p>
        <p className="mt-1 break-words text-[17px] font-semibold">{r.product}</p>
        {r.description && <p className="mt-1 break-words text-sm text-ink-soft">{r.description}</p>}
      </div>
      <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto sm:flex-none">
        <button className="btn-ghost btn-sm" disabled={busy} onClick={reply}>
          {requester.has_phone ? 'Reply on WhatsApp' : 'Reply by Email'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={`Dismiss request for ${r.product}`}
          title="Dismiss"
          className="flex h-10 w-10 items-center justify-center rounded-control text-ink-soft hover:bg-bg hover:text-ink"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  )
}

// Different students who opened the listing / tapped Contact Seller, with a nudge when lots of
// people look but nobody gets in touch (the price or photos are usually why).
const NUDGE_VIEWS = 10

function ListingStats({ l }) {
  if (l.views == null) return null
  const nudge = l.status === 'available' && l.views >= NUDGE_VIEWS && l.contacts === 0
  return (
    <>
      <p className="mt-0.5 text-sm text-ink-soft">
        <span title="Different students who opened this listing">{l.views} {l.views === 1 ? 'view' : 'views'}</span>
        <span className="mx-1.5">·</span>
        <span title="Different students who tapped Contact Seller">{l.contacts} {l.contacts === 1 ? 'contact' : 'contacts'}</span>
      </p>
      {nudge && (
        <p className="mt-0.5 text-[13px] font-medium text-[#854D0E]">
          Lots of views but no contacts yet. A lower price or clearer photos usually help.
        </p>
      )}
    </>
  )
}
