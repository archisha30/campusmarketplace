import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { SkeletonRows } from '../components/SkeletonCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Avatar from '../components/Avatar.jsx'
import { useRequestNotifications } from '../hooks/useRequestNotifications.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { formatPrice, isExpired, titleCase, timeAgo } from '../lib/format.js'

const TABS = [
  { label: 'Active', status: 'available' },
  { label: 'Reserved', status: 'reserved' },
  { label: 'Sold', status: 'sold' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState(TABS[0])

  const { data, loading, refetch } = useApi(
    () => listingsApi.list({ seller_id: user?.id, status: tab.status, include_sold: true }),
    [user?.id, tab.status]
  )
  const items = data?.items || []

  async function changeStatus(id, status) {
    await listingsApi.setStatus(id, status)
    toast(status === 'available' ? 'Listing is available again' : `Marked ${status}`)
    refetch()
  }

  async function remove(id) {
    await listingsApi.remove(id)
    toast('Listing deleted')
    refetch()
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <Notifications />
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

      {!loading && items.length === 0 && (
        <EmptyState
          emoji="📭"
          title="Nothing here yet"
          body="Be the first person to list something on your campus."
          actionLabel="Sell an Item"
          actionTo="/sell"
        />
      )}

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
            <button className="btn-danger btn-sm" onClick={() => remove(l.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Notifications() {
  const { items, loading, markAllRead } = useNotifications({ freeze: true })
  const [showAll, setShowAll] = useState(false)
  const fresh = items.filter((n) => !n.read).length

  // Opening the dashboard marks everything read (clearing the navbar badge); the
  // "New" markers stay for this visit because the list keeps its load-time snapshot.
  useEffect(() => {
    if (!loading && fresh > 0) markAllRead()
  }, [loading, fresh, markAllRead])

  const shown = showAll ? items : items.slice(0, 5)

  return (
    <section id="notifications" className="mb-6 scroll-mt-24 rounded-slab border border-line bg-paper p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold">
          Notifications
          {fresh > 0 && (
            <span className="rounded-pill bg-coral px-2 py-0.5 text-[11.5px] font-bold text-white">{fresh} new</span>
          )}
        </h2>
        <p className="text-[13px] text-ink-faint">Access requests, students reaching out, and reports on your items</p>
      </div>

      {loading && <div className="skeleton h-20" />}

      {!loading && items.length === 0 && (
        <p className="rounded-card bg-bg px-4 py-6 text-center text-[14px] text-ink-soft">
          Nothing yet. You'll see it here when someone requests access or contacts you about a listing or resource.
        </p>
      )}

      {!loading && shown.map((n) => <NotificationRow key={n.id} n={n} />)}

      {!loading && items.length > 5 && (
        <button className="mt-2 text-[13.5px] font-semibold text-brand hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${items.length} notifications`}
        </button>
      )}
    </section>
  )
}

function NotificationRow({ n }) {
  const { actor } = n
  const fresh = !n.read
  const href = n.target_type === 'listing' ? `/listing/${n.target_id}` : `/resources/${n.target_id}`
  const item = <Link to={href} className="font-semibold text-ink hover:underline">{n.target_title}</Link>
  const greeting = `Hi ${actor.name}! Following up on "${n.target_title}" from CampusMarket.`
  const reply = actor.phone
    ? `https://wa.me/${actor.phone}?text=${encodeURIComponent(greeting)}`
    : `https://mail.google.com/mail/?${new URLSearchParams({
        view: 'cm', fs: '1', to: actor.email, su: `CampusMarket — ${n.target_title}`, body: greeting,
      })}`

  const isReport = n.type === 'report'
  let icon
  let text
  if (isReport) {
    icon = '⚠️'
    text = <>reported your {n.target_type} {item}</>
  } else if (n.type === 'access_request') {
    icon = '🔑'
    text = <>requested access to {item}</>
  } else {
    icon = n.channel === 'whatsapp' ? '💬' : '✉️'
    text = <>opened {n.channel === 'whatsapp' ? 'WhatsApp' : 'email'} to message you about {item}</>
  }

  return (
    <div className={`mb-2.5 flex flex-wrap items-start gap-3.5 rounded-card border p-3.5 ${fresh ? 'border-brand/30 bg-brand-tint/50' : 'border-line'}`}>
      <div className="relative flex-none">
        {isReport ? (
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-coral/15 text-[16px]" aria-hidden>🚩</div>
        ) : (
          <Avatar user={actor} size={38} className="bg-sun font-display text-ink" />
        )}
        <span className="absolute -bottom-1 -right-1 text-[14px]" aria-hidden>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[14px] text-ink-soft">
          <span className="font-semibold text-ink">{actor.name}</span> {text}
        </p>
        {n.note && (
          isReport
            ? <p className="mt-1 text-[13.5px]"><span className="font-semibold">Reason:</span> {n.note}. Our team will review it; if something's wrong, edit or remove the item.</p>
            : <p className="mt-1 break-words text-[13.5px]">“{n.note}”</p>
        )}
        <p className="mt-1 text-[12px] text-ink-faint">
          {timeAgo(n.created_at)}
          {fresh && <span className="ml-2 rounded-pill bg-brand px-1.5 py-px text-[10.5px] font-bold text-white">New</span>}
          {n.type === 'contact' && <span className="ml-2">· check your {n.channel === 'whatsapp' ? 'WhatsApp' : 'inbox'}</span>}
        </p>
      </div>
      <div className="flex flex-none flex-wrap gap-2">
        {isReport ? (
          <Link to={href} className="btn-ghost btn-sm">View item</Link>
        ) : n.type === 'access_request' ? (
          <Link to={`${href}#manage`} className="btn-accent btn-sm">Review request</Link>
        ) : (
          <a className="btn-ghost btn-sm" href={reply} target="_blank" rel="noopener noreferrer">
            {actor.phone ? 'Reply on WhatsApp' : 'Reply by Email'}
          </a>
        )}
      </div>
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
  const greeting = `Hi ${requester.name}! I saw your request for "${r.product}" on CampusMarket. I might have it.`
  const reply = requester.phone
    ? `https://wa.me/${requester.phone}?text=${encodeURIComponent(greeting)}`
    : `https://mail.google.com/mail/?${new URLSearchParams({
        view: 'cm', fs: '1', to: requester.email, su: `CampusMarket — ${r.product}`, body: greeting,
      })}`

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
      <a className="btn-ghost btn-sm flex-none" href={reply} target="_blank" rel="noopener noreferrer">
        {requester.phone ? 'Reply on WhatsApp' : 'Reply by Email'}
      </a>
    </div>
  )
}
