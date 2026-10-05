import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { resourcesApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { VerifiedBadge } from '../components/Badge.jsx'
import ReportModal from '../components/ReportModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LinkifiedText from '../components/LinkifiedText.jsx'
import ResourcePreview from '../components/ResourcePreview.jsx'
import Avatar from '../components/Avatar.jsx'
import { formatPhone, formatPrice, timeAgo } from '../lib/format.js'
import { recordContact } from '../hooks/useNotifications.js'
import { NOTE_MAX, deliveryLabel, upiLink, yearLabel } from '../lib/resources.js'

export default function ResourceDetail() {
  const { id } = useParams()
  const [reporting, setReporting] = useState(false)
  const { data: r, loading, error, setData, refetch } = useApi(() => resourcesApi.get(id), [id])

  if (loading && !r) return <div className="mx-auto max-w-[1180px] px-6 py-9"><div className="skeleton h-96" /></div>
  if (error || !r) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-9">
        <EmptyState emoji="📚" title="Resource not found" body="It may have been removed by the owner." actionLabel="Back to Resource Hub" actionTo="/resources" />
      </div>
    )
  }

  const access = r.access || { full: false, reason: 'guest' }
  const isManager = access.reason === 'owner' || access.reason === 'admin'

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <Link to="/resources" className="btn-ghost btn-sm mb-5">← Back to Resource Hub</Link>

      <div className="grid gap-10 md:grid-cols-[1fr_1fr]">
        <div className="order-2 md:order-1">
          <ResourcePreview resource={r} {...previewOverlay(r, access)} />
        </div>

        <div className="order-1 md:order-2">
          <ResourceBadges r={r} />
          <h1 className="mt-3 text-[28px] font-bold">{r.title}</h1>
          <p className="my-3 font-display text-[32px] font-bold">{r.offer_type === 'free' ? 'Free' : formatPrice(r.price)}</p>

          <dl className="my-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-4 text-[13.5px] text-ink-soft">
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
            <p className="my-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft"><LinkifiedText text={r.description} /></p>
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
    </div>
  )
}

function ResourceBadges({ r }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`badge ${r.offer_type === 'free' ? 'bg-coral/12 text-coral' : 'bg-brand-tint text-brand'}`}>
        {r.offer_type === 'free' ? 'Free' : 'For sale'}
      </span>
      <span className="badge bg-bg text-ink-soft">{r.copy_type === 'hard' ? 'Hard copy' : 'Soft copy'}</span>
      {r.copy_type === 'soft' && <span className="badge bg-bg text-ink-soft">{deliveryLabel(r)}</span>}
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
        <p className="mb-3 text-[14.5px] font-semibold text-leaf">✓ {intro}</p>
        {r.copy_type === 'hard' && (
          <p className="mb-3 text-[13.5px] text-ink-soft">
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
        <p className="mb-3 text-[14.5px] text-ink-soft">
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
        <p className="mb-3 text-[14.5px] text-ink-soft">Verify your college email to get this resource.</p>
        <Link to="/login" state={{ from: location.pathname }} className="btn-accent">Verify email</Link>
      </>
    )
  } else if (access.reason === 'closed') {
    body = <p className="text-[14.5px] text-ink-soft">The owner has closed this resource, so it can’t be requested right now.</p>
  } else {
    // locked: paid resource, verified viewer without an approved grant
    const pay = r.upi_id
      ? upiLink({ upiId: r.upi_id, name: r.owner.name, amount: r.price, note: `CampusMarket: ${r.title}` })
      : null
    body = (
      <>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-[13.5px] text-ink-soft">
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
          <div className="rounded-[11px] bg-sun/20 p-3.5 text-[13.5px]">
            <p className="font-semibold text-[#946B00]">Request pending · sent {timeAgo(access.request.updated_at)}</p>
            {access.request.note && <p className="mt-1 text-ink-soft">“{access.request.note}”</p>}
            <p className="mt-1 text-ink-soft">The owner will approve it once they confirm your payment.</p>
          </div>
        )}

        {status === 'denied' && (
          <p className="mb-3 rounded-[11px] bg-coral/10 p-3.5 text-[13.5px] text-coral">
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
    <section id="access" className="my-5 scroll-mt-24 rounded-card border border-line bg-paper p-5">
      {body}
    </section>
  )
}

function OwnerCard({ r }) {
  const { user } = useAuth()
  const o = r.owner
  const message = `Hi! I'm interested in "${r.title}" on CampusMarket's Resource Hub.`
  return (
    <div className="my-5 rounded-card border border-line bg-paper p-4">
      <div className="flex items-center gap-3.5">
        <Avatar user={o} size={44} className="bg-sun font-display text-ink" />
        <div>
          <p className="text-[14.5px] font-semibold">{o.name || 'Campus student'}</p>
          <p className="text-[13px] text-ink-soft">{o.campus || ''}</p>
        </div>
        {o.verified && <span className="ml-auto"><VerifiedBadge /></span>}
      </div>
      {(o.phone || o.email) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {o.phone && (
            <a className="btn-ghost btn-sm" href={`https://wa.me/${o.phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
              onClick={() => recordContact(user, 'resource', r.id, 'whatsapp')}>
              WhatsApp {formatPhone(o.phone)}
            </a>
          )}
          {o.email && (
            <a
              className="btn-ghost btn-sm"
              href={`https://mail.google.com/mail/?${new URLSearchParams({ view: 'cm', fs: '1', to: o.email, su: `CampusMarket: ${r.title}`, body: message })}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordContact(user, 'resource', r.id, 'email')}
            >
              Email
            </a>
          )}
        </div>
      ) : (
        r.access?.reason === 'guest' || r.access?.reason === 'unverified'
          ? <p className="mt-3 text-[12.5px] text-ink-faint">Log in as a verified student to see contact details.</p>
          : null
      )}
    </div>
  )
}

function OwnerPanel({ r, onChange, refetch }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
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
    if (!window.confirm(`Delete "${r.title}"? This also removes its files and access requests.`)) return
    setBusy(true)
    try {
      await resourcesApi.remove(r.id)
      toast('Resource deleted')
      navigate('/resources', { replace: true })
    } catch (err) {
      toast(err.message)
      setBusy(false)
    }
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
    <section id="manage" className="mt-6 scroll-mt-24 rounded-card border-[1.5px] border-brand/30 bg-brand-tint/40 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[18px] font-bold">{isOwner ? 'Manage your resource' : 'Admin controls'}</h2>
        {isOwner && (
          <>
            <button className="btn-ghost btn-sm" onClick={toggleStatus} disabled={busy}>
              {r.status === 'available' ? 'Close' : 'Reopen'}
            </button>
            <Link to={`/resources/${r.id}/edit`} className="btn-ghost btn-sm">Edit</Link>
          </>
        )}
        <button className="btn-danger btn-sm" onClick={remove} disabled={busy}>Delete</button>
      </div>
      <p className="mb-4 text-[13px] text-ink-soft">
        Status: <span className="font-semibold text-ink">{r.status === 'available' ? 'Available' : 'Closed'}</span>
        {r.status === 'closed' && ' · hidden from the Resource Hub, approved buyers keep access'}
      </p>

      {r.offer_type === 'sale' && (
        <>
          <h3 className="mb-2 text-[15px] font-semibold">
            Access requests {r.pending_requests ? <span className="badge ml-1 bg-sun/25 text-[#946B00]">{r.pending_requests} pending</span> : null}
          </h3>
          {requests.loading && !requests.data && <div className="skeleton h-16" />}
          {requests.error && <p className="text-[13px] text-coral">{requests.error.message}</p>}
          {!requests.loading && rows.length === 0 && (
            <p className="text-[13.5px] text-ink-soft">No requests yet. Buyers pay you by UPI or cash, then request access here.</p>
          )}
          <ul className="space-y-2.5">
            {rows.map((a) => (
              <li key={a.id} className="rounded-[12px] border border-line bg-paper p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold">{a.requester?.name}</span>
                  <RequestStatus status={a.status} />
                  <span className="ml-auto text-[12px] text-ink-faint">{timeAgo(a.updated_at)}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-ink-soft">
                  {a.requester?.email}{a.requester?.phone ? ` · ${formatPhone(a.requester.phone)}` : ''}
                </p>
                {a.note && <p className="mt-1.5 text-[13.5px]">“{a.note}”</p>}
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
    </section>
  )
}

function RequestStatus({ status }) {
  const tone = {
    pending: 'bg-sun/25 text-[#946B00]',
    approved: 'bg-leaf/10 text-leaf',
    denied: 'bg-coral/10 text-coral',
  }[status]
  return <span className={`badge ${tone}`}>{status[0].toUpperCase() + status.slice(1)}</span>
}
