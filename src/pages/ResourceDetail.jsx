import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { adminApi, resourcesApi } from '../services/api.js'
import { useReportSummary } from '../hooks/useReportSummary.jsx'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { useWishlist } from '../hooks/useWishlist.jsx'
import { VerifiedBadge } from '../components/Badge.jsx'
import ReportModal from '../components/ReportModal.jsx'
import ShareButton from '../components/ShareButton.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import RemoveItemModal from '../components/RemoveItemModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LinkifiedText from '../components/LinkifiedText.jsx'
import ResourcePreview from '../components/ResourcePreview.jsx'
import Avatar from '../components/Avatar.jsx'
import { formatPhone, formatPrice, timeAgo } from '../lib/format.js'
import { openContact } from '../lib/contact.js'
import { recordResourceView } from '../lib/recommendations.js'
import { trackEvent } from '../lib/analytics.js'
import ResourcePicks from '../components/ResourcePicks.jsx'
import { NOTE_MAX, deliveryLabel, upiLink, yearLabel } from '../lib/resources.js'
import Icon from '../components/Icon.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import { FreeTag } from '../components/PriceTag.jsx'
import WhatsAppIcon from '../components/WhatsAppIcon.jsx'

export default function ResourceDetail() {
  const { id } = useParams()
  const [reporting, setReporting] = useState(false)
  const { data: r, loading, error, setData, refetch } = useApi(() => resourcesApi.get(id), [id])
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    // Feeds Resource Hub recommendations; waits for the session check so it's saved to the right account.
    if (r && !authLoading) recordResourceView(user, r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id, authLoading])

  if (loading && !r) return <div className="wrap py-8"><div className="skeleton h-96" /></div>
  if (error || !r) {
    return (
      <div className="wrap py-8">
        <EmptyState icon="book-open" title="Resource not found" body="It may have been removed by the owner." actionLabel="Back to Resource Hub" actionTo="/resources" />
      </div>
    )
  }

  const access = r.access || { full: false, reason: 'guest' }
  const isManager = access.reason === 'owner' || access.reason === 'admin'

  return (
    <div className="wrap py-8">
      <Breadcrumb items={[{ label: 'Resource Hub', to: '/resources' }, { label: r.subject }, { label: r.title }]} />

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <div className="order-2 min-w-0 md:order-1">
          <ResourcePreview resource={r} {...previewOverlay(r, access)} />
        </div>

        <div className="order-1 min-w-0 md:order-2">
          <div className="flex flex-wrap items-start gap-2">
            <ResourceBadges r={r} />
            <ShareButton
              className="ml-auto"
              title={r.title}
              path={`/resources/${r.id}`}
              message={`Check out "${r.title}" (${r.subject}, ${r.offer_type === 'free' ? 'free' : formatPrice(r.price)}) on the CampusMarket Resource Hub`}
            />
            {r.access?.reason !== 'owner' && <SaveResourceButton r={r} />}
          </div>
          <h1 className="mt-4 break-words text-[32px] leading-[1.1] lg:text-[40px]">{r.title}</h1>
          <p className="hd mt-4 text-[34px] lg:text-[40px]">{r.offer_type === 'free' ? <FreeTag /> : formatPrice(r.price)}</p>

          <dl className="my-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-4 text-[15px] text-ink-soft">
            <div><dt className="inline font-semibold text-ink">Subject: </dt><dd className="inline">{r.subject}</dd></div>
            <div><dt className="inline font-semibold text-ink">Year: </dt><dd className="inline">{yearLabel(r.year)}</dd></div>
            <div><dt className="inline font-semibold text-ink">Format: </dt><dd className="inline">{r.copy_type === 'hard' ? 'Hard copy' : `Soft copy · ${deliveryLabel(r)}`}</dd></div>
            {r.page_count ? (
              <div>
                <dt className="inline font-semibold text-ink">Pages: </dt>
                <dd className="inline">{r.page_count}{r.copy_type === 'hard' || r.delivery === 'drive' ? ' (sample)' : ''}</dd>
              </div>
            ) : null}
            {r.pickup_spot && <div><dt className="inline font-semibold text-ink">Pickup: </dt><dd className="inline">{r.pickup_spot}</dd></div>}
          </dl>

          {r.description && (
            <p className="my-4 whitespace-pre-line break-words text-[17px] leading-relaxed text-[#3B3B47]"><LinkifiedText text={r.description} /></p>
          )}

          <AccessPanel r={r} access={access} onChange={setData} />

          <OwnerCard r={r} />

          {isManager ? (
            <OwnerPanel r={r} onChange={setData} refetch={refetch} />
          ) : (
            <button className="btn-ghost btn-sm mt-4" onClick={() => setReporting(true)}>Report resource</button>
          )}
        </div>
      </div>

      <ReportModal open={reporting} onClose={() => setReporting(false)} targetTitle={r.title} resourceId={r.id} />

      <ResourcePicks excludeId={r.id} title="More like this" variant="row" />
    </div>
  )
}

function ResourceBadges({ r }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`badge ${r.offer_type === 'free' ? 'bg-sun text-ink' : 'bg-brand-tint text-brand'}`}>
        {r.offer_type === 'free' ? 'Free' : 'For sale'}
      </span>
      <span className="badge border border-line bg-paper text-ink-soft">{r.copy_type === 'hard' ? 'Hard copy' : 'Soft copy'}</span>
      {r.copy_type === 'soft' && <span className="badge border border-line bg-paper text-ink-soft">{deliveryLabel(r)}</span>}
      {r.status === 'closed' && <span className="badge bg-line/60 text-ink-faint">Closed</span>}
    </div>
  )
}

// What the lock overlay on the preview says, per viewer state.
function previewOverlay(r, access) {
  const pages = Math.max(0, (r.page_count || 0) - 1)
  const scrollCta = (label) => (
    <a href="#access" className="btn-accent btn-sm">{label}</a>
  )
  if (access.full) {
    if (r.copy_type === 'hard') {
      return { overlayTitle: 'Your copy is waiting', overlayBody: `Pick it up at ${r.pickup_spot}.`, cta: null }
    }
    return {
      overlayTitle: 'You have full access',
      overlayBody: r.delivery === 'drive' ? 'Open the drive link to get everything.' : `Open the PDF to read all ${r.page_count || ''} pages.`,
      cta: scrollCta(r.delivery === 'drive' ? 'Open drive link' : 'Open PDF'),
    }
  }
  const more = pages > 0 ? `${pages} more page${pages === 1 ? '' : 's'}` : null
  const title = r.copy_type === 'hard'
    ? 'Get the printed copy'
    : `Unlock the full resource${more ? `, ${more}` : ''}`
  switch (access.reason) {
    case 'guest':
      return { overlayTitle: title, overlayBody: 'Log in with your college email to continue.', cta: scrollCta(r.offer_type === 'free' ? 'Log in to get it free' : 'Log in to unlock') }
    case 'unverified':
      return { overlayTitle: title, overlayBody: 'Verify your college email to continue.', cta: null }
    case 'closed':
      return { overlayTitle: 'No longer available', overlayBody: 'The owner closed this resource.', cta: null }
    default: {
      const status = access.request?.status
      if (status === 'pending') return { overlayTitle: title, overlayBody: 'Your request is with the owner.', cta: null }
      return {
        overlayTitle: title,
        overlayBody: `Pay ${formatPrice(r.price)} by UPI or cash, then request access.`,
        cta: scrollCta(status === 'denied' ? 'Request again' : 'Request access'),
      }
    }
  }
}

function useResourceFile(r) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function open({ download = false } = {}) {
    // Open the tab synchronously so popup blockers allow it, then point it at the blob.
    const win = download ? null : window.open('', '_blank')
    setBusy(true)
    try {
      const blob = await resourcesApi.file(r.id)
      const url = URL.createObjectURL(blob)
      if (win) {
        win.location.href = url
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `${r.title.replace(/[^\w-]+/g, '-').slice(0, 60) || 'resource'}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      win?.close()
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }
  return { open, busy }
}

function FileButtons({ r, label = 'Open PDF' }) {
  const { open, busy } = useResourceFile(r)
  if (!r.has_file) return null
  return (
    <>
      <button className="btn-accent" onClick={() => open()} disabled={busy}>{busy ? 'Loading…' : label}</button>
      <button className="btn-ghost" onClick={() => open({ download: true })} disabled={busy}>Download</button>
    </>
  )
}

function AccessPanel({ r, access, onChange }) {
  const location = useLocation()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const status = access.request?.status

  async function request() {
    setSending(true)
    try {
      await resourcesApi.requestAccess(r.id, note.trim() || null)
      trackEvent('request_access', { subject: r.subject })
      onChange(await resourcesApi.get(r.id))
      setNote('')
      toast('Request sent to the owner')
    } catch (err) {
      toast(err.message)
    } finally {
      setSending(false)
    }
  }

  let body
  if (access.full) {
    const intro = {
      owner: 'This is your resource.',
      admin: 'Admin view: full access.',
      free: r.copy_type === 'hard' ? 'Free to pick up.' : 'Free for verified students.',
      granted: 'The owner approved your access.',
    }[access.reason]
    body = (
      <>
        <p className="mb-3 flex items-center gap-2 font-semibold text-leaf"><Icon name="circle-check" />{intro}</p>
        {r.copy_type === 'hard' && (
          <p className="mb-3 text-sm text-ink-soft">
            Pick it up at <span className="font-semibold text-ink">{r.pickup_spot}</span>. Message the owner to set a time.
          </p>
        )}
        <div className="flex flex-wrap gap-2.5">
          {r.drive_url && (
            <a className="btn-accent" href={r.drive_url} target="_blank" rel="noopener noreferrer">Open drive link</a>
          )}
          <FileButtons r={r} label={r.copy_type === 'hard' || r.delivery === 'drive' ? 'Open sample PDF' : 'Open PDF'} />
        </div>
      </>
    )
  } else if (access.reason === 'guest') {
    body = (
      <>
        <p className="mb-3 text-[15px] text-ink-soft">
          {r.offer_type === 'free'
            ? 'Free for verified students. Log in with your college email to get it.'
            : 'Log in with your college email to request access and see payment details.'}
        </p>
        <Link to="/login" state={{ from: location.pathname }} className="btn-accent">Log in</Link>
      </>
    )
  } else if (access.reason === 'unverified') {
    body = (
      <>
        <p className="mb-3 text-[15px] text-ink-soft">Verify your college email to get this resource.</p>
        <Link to="/login" state={{ from: location.pathname }} className="btn-accent">Verify email</Link>
      </>
    )
  } else if (access.reason === 'closed') {
    body = <p className="text-[15px] text-ink-soft">The owner has closed this resource, so it can’t be requested right now.</p>
  } else {
    // locked: paid resource, verified viewer without an approved grant
    const pay = r.upi_id
      ? upiLink({ upiId: r.upi_id, name: r.owner.name, amount: r.price, note: `CampusMarket: ${r.title}` })
      : null
    body = (
      <>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>
            Pay <span className="font-semibold text-ink">{formatPrice(r.price)}</span> to {r.owner.name}
            {r.upi_id ? <> by UPI (<span className="font-mono text-[12.5px]">{r.upi_id}</span>) or cash.</> : ' by UPI or cash. Message them for details.'}
          </li>
          <li>Request access below, mentioning how you paid.</li>
          <li>Once the owner approves, {r.copy_type === 'hard' ? 'collect the copy at the pickup spot.' : 'the full resource unlocks here.'}</li>
        </ol>

        {pay && status !== 'pending' && (
          <a href={pay} className="btn-ghost mb-4">Pay {formatPrice(r.price)} with UPI app</a>
        )}

        {status === 'pending' && (
          <div className="rounded-control bg-[#FFF8DC] p-4 text-sm">
            <p className="font-semibold text-ink">Request pending · sent {timeAgo(access.request.updated_at)}</p>
            {access.request.note && <p className="mt-1 text-ink-soft">“{access.request.note}”</p>}
            <p className="mt-1 text-ink-soft">The owner will approve it once they confirm your payment.</p>
          </div>
        )}

        {status === 'denied' && (
          <p className="mb-3 rounded-control bg-coral/10 p-3.5 text-sm text-coral">
            The owner declined your last request. Check with them, then you can ask again.
          </p>
        )}

        {access.can_request && (
          <div>
            <label className="field-label" htmlFor="access-note">Note to owner <span className="font-normal text-ink-faint">(optional)</span></label>
            <input
              id="access-note"
              className="field-input"
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid via UPI, ref 4471"
            />
            <button className="btn-accent mt-3" onClick={request} disabled={sending}>
              {sending ? 'Sending…' : status === 'denied' ? 'Request again' : 'Request access'}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <section id="access" className="card my-6 scroll-mt-24 p-6">
      {body}
    </section>
  )
}

function OwnerCard({ r }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const o = r.owner
  const isOwn = r.access?.reason === 'owner'

  // The owner's number/email isn't in the page; it's fetched only when a button is tapped.
  async function contact(channel) {
    setBusy(true)
    try {
      await openContact({
        targetType: 'resource',
        targetId: r.id,
        channel,
        subject: `CampusMarket: ${r.title}`,
        message: `Hi! I'm interested in "${r.title}" on CampusMarket's Resource Hub.`,
      })
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card my-6 p-6">
      <div className="flex items-center gap-4">
        <Avatar user={o} size={56} className="bg-[#FFE4CF] font-display text-ink" />
        <div>
          <Link to={`/u/${o.id}`} className="text-[15px] font-semibold hover:underline">{o.name || 'Campus student'}</Link>
          {o.verified && <p className="mt-1"><VerifiedBadge /></p>}
          <p className="mt-1 text-sm text-ink-soft">
            {o.campus ? `${o.campus} · ` : ''}
            <Link to={`/u/${o.id}`} className="font-semibold text-brand hover:underline">See their items</Link>
          </p>
        </div>
      </div>
      {!isOwn && (
        <div className="mt-4 flex flex-wrap gap-2">
          {o.has_phone && (
            <button className="btn btn-whatsapp btn-sm" disabled={busy} onClick={() => contact('whatsapp')}><WhatsAppIcon size={18} />WhatsApp</button>
          )}
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => contact('email')}>Email</button>
        </div>
      )}
    </div>
  )
}

function OwnerPanel({ r, onChange, refetch }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { refresh: refreshSummary } = useReportSummary()
  const isOwner = r.access?.reason === 'owner'
  const requests = useApi(
    () => (r.offer_type === 'sale' ? resourcesApi.accessRequests(r.id) : Promise.resolve([])),
    [r.id, r.offer_type, user?.id]
  )

  async function toggleStatus() {
    setBusy(true)
    try {
      onChange(await resourcesApi.setStatus(r.id, r.status === 'available' ? 'closed' : 'available'))
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await resourcesApi.remove(r.id)
      toast('Resource deleted. Restore it from your dashboard within 24 hours')
      navigate('/resources', { replace: true })
    } catch (err) {
      toast(err.message)
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  // An admin removing someone else's resource: gone for good, and the owner is told why.
  async function adminRemove(reason) {
    await adminApi.removeResource(r.id, reason)
    refreshSummary() // its open reports were resolved
    toast('Resource removed. The owner has been told why')
    navigate('/resources', { replace: true })
  }

  async function decide(reqId, status) {
    try {
      await resourcesApi.decideAccess(r.id, reqId, status)
      toast(status === 'approved' ? 'Access approved' : 'Request denied')
      requests.refetch()
      refetch()
    } catch (err) {
      toast(err.message)
    }
  }

  const rows = requests.data || []

  return (
    <section id="manage" className="mt-6 scroll-mt-24 rounded-card border border-brand/30 bg-brand-tint p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl">{isOwner ? 'Manage your resource' : 'Admin controls'}</h2>
        {isOwner && (
          <>
            <button className="btn-ghost btn-sm" onClick={toggleStatus} disabled={busy}>
              {r.status === 'available' ? 'Close' : 'Reopen'}
            </button>
            <Link to={`/resources/${r.id}/edit`} className="btn-ghost btn-sm">Edit</Link>
          </>
        )}
        <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(true)} disabled={busy}>{isOwner ? 'Delete' : 'Remove'}</button>
      </div>
      {r.held && (
        <p className="mb-4 rounded-control bg-coral/5 p-4 text-sm text-coral">
          <strong>Held for review.</strong> Several students reported this resource, so it's hidden from everyone else until
          the CampusMarket team reviews it.
          {isOwner
            ? " You can still edit it; you'll get a notification with the outcome."
            : <> Resolve or remove it from <Link to="/admin/reports" className="font-semibold underline">Admin → Reports</Link>.</>}
        </p>
      )}
      <p className="mb-4 text-[13px] text-ink-soft">
        Status: <span className="font-semibold text-ink">{r.status === 'available' ? 'Available' : 'Closed'}</span>
        {r.status === 'closed' && ' · hidden from the Resource Hub, approved buyers keep access'}
      </p>

      {r.offer_type === 'sale' && (
        <>
          <h3 className="mb-2 text-[15px] font-semibold">
            Access requests {r.pending_requests ? <span className="badge ml-1 bg-sun text-ink">{r.pending_requests} pending</span> : null}
          </h3>
          {requests.loading && !requests.data && <div className="skeleton h-16" />}
          {requests.error && <p className="text-[13px] text-coral">{requests.error.message}</p>}
          {!requests.loading && rows.length === 0 && (
            <p className="text-sm text-ink-soft">No requests yet. Buyers pay you by UPI or cash, then request access here.</p>
          )}
          <ul className="space-y-2.5">
            {rows.map((a) => (
              <li key={a.id} className="rounded-control border border-line bg-paper p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold">{a.requester?.name}</span>
                  <RequestStatus status={a.status} />
                  <span className="ml-auto text-[12px] text-ink-faint">{timeAgo(a.updated_at)}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-ink-soft">
                  {a.requester?.email}{a.requester?.phone ? ` · ${formatPhone(a.requester.phone)}` : ''}
                </p>
                {a.note && <p className="mt-1.5 text-sm">“{a.note}”</p>}
                <div className="mt-2.5 flex gap-2">
                  {a.status !== 'approved' && (
                    <button className="btn-accent btn-sm" onClick={() => decide(a.id, 'approved')}>Approve</button>
                  )}
                  {a.status !== 'denied' && (
                    <button className="btn-ghost btn-sm" onClick={() => decide(a.id, 'denied')}>
                      {a.status === 'approved' ? 'Revoke' : 'Deny'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <ConfirmModal open={isOwner && confirmDelete} title="Delete this resource?" confirmLabel="Yes, delete" busyLabel="Deleting…"
        danger busy={busy} onConfirm={remove} onClose={() => setConfirmDelete(false)}>
        Are you sure you want to delete <strong className="text-ink">“{r.title}”</strong>? You can restore it from the
        <strong className="text-ink"> Deleted</strong> tab on your Seller Dashboard for 24 hours.
      </ConfirmModal>
      <RemoveItemModal item={!isOwner && confirmDelete ? { kind: 'resource', title: r.title } : null}
        onRemove={adminRemove} onClose={() => setConfirmDelete(false)} />
    </section>
  )
}

function RequestStatus({ status }) {
  const tone = {
    pending: 'bg-sun text-ink',
    approved: 'bg-leaf/10 text-leaf',
    denied: 'bg-coral/10 text-coral',
  }[status]
  return <span className={`badge ${tone}`}>{status[0].toUpperCase() + status.slice(1)}</span>
}

// Same look as the listing page's "Save to wishlist".
function SaveResourceButton({ r }) {
  const { isResourceSaved, toggleResource } = useWishlist()
  const toast = useToast()
  const saved = isResourceSaved(r.id)
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toast(toggleResource(r) ? 'Saved to your wishlist' : 'Removed from your wishlist')}
      className="chip"
    >
      <Icon name="heart" size={18} filled={saved} className={saved ? 'text-coral' : ''} />
      {saved ? 'Saved' : 'Save to wishlist'}
    </button>
  )
}
