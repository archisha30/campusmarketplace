import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import Modal from './Modal.jsx'
import { useNotifications } from '../hooks/useNotifications.js'
import { useToast } from '../hooks/useToast.jsx'
import { timeAgo } from '../lib/format.js'
import Icon from './Icon.jsx'
import WhatsAppIcon from './WhatsAppIcon.jsx'

// The notification list, shared by the seller dashboard and /notifications (everyone).
// `previewCount` rows show first, with "Show N more" for the rest (Infinity = show all).
export default function NotificationsPanel({ previewCount = 2, blurb, empty }) {
  const { items, loading, markAllRead, dismiss, clearAll } = useNotifications({ freeze: true })
  const toast = useToast()
  const [showAll, setShowAll] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const fresh = items.filter((n) => !n.read).length

  async function onDismiss(id) {
    try {
      await dismiss(id)
    } catch (err) {
      toast(err.message || "Couldn't dismiss that notification")
    }
  }

  async function onClearAll() {
    setClearing(true)
    try {
      await clearAll()
      setConfirmClear(false)
      setShowAll(false)
      toast('Notifications cleared')
    } catch (err) {
      toast(err.message || "Couldn't clear notifications")
    } finally {
      setClearing(false)
    }
  }

  // Opening the list marks everything read (clearing the navbar badge); the "New"
  // markers stay for this visit because the list keeps its load-time snapshot.
  useEffect(() => {
    if (!loading && fresh > 0) markAllRead()
  }, [loading, fresh, markAllRead])

  const shown = showAll ? items : items.slice(0, previewCount)
  const hidden = items.length - previewCount

  return (
    <section id="notifications" className="card mb-8 scroll-mt-24 p-6 md:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl">
          Notifications
          {fresh > 0 && (
            <span className="rounded-lg bg-coral px-2 py-1 font-sans text-xs font-bold leading-none tracking-normal text-white">{fresh} new</span>
          )}
        </h2>
        {!loading && items.length > 0 && (
          <button className="btn-ghost btn-sm" onClick={() => setConfirmClear(true)}>Clear all</button>
        )}
      </div>
      {blurb && <p className="-mt-2 mb-4 text-sm text-ink-soft">{blurb}</p>}

      {loading && <div className="skeleton h-20" />}

      {!loading && items.length === 0 && (
        <p className="rounded-card bg-bg px-4 py-6 text-center text-[15px] text-ink-soft">{empty}</p>
      )}

      {!loading && shown.map((n) => <NotificationRow key={n.id} n={n} onDismiss={() => onDismiss(n.id)} />)}

      {!loading && hidden > 0 && (
        <button
          className="mt-1 text-sm font-semibold text-brand hover:underline"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}

      <Modal open={confirmClear} onClose={() => !clearing && setConfirmClear(false)} title="Clear all notifications?">
        <p className="text-[15px] text-ink-soft">This removes all {items.length} notifications. It can't be undone.</p>
        <div className="mt-5 flex gap-2.5">
          <button className="btn-ghost flex-1" onClick={() => setConfirmClear(false)} disabled={clearing} autoFocus>Cancel</button>
          <button className="btn-danger flex-1" onClick={onClearAll} disabled={clearing}>{clearing ? 'Clearing…' : 'Clear all'}</button>
        </div>
      </Modal>
    </section>
  )
}

// Types sent by the CampusMarket team (shown with the CM badge, never an admin's name).
const FROM_TEAM = new Set(['removed', 'report_cleared', 'held'])

function NotificationRow({ n, onDismiss }) {
  const { actor } = n
  const fresh = !n.read
  const href = {
    listing: `/listing/${n.target_id}`,
    resource: `/resources/${n.target_id}`,
    request: '/profile#requests', // your own "Looking for" requests
  }[n.target_type]
  const item = <Link to={href} className="font-semibold text-ink hover:underline">{n.target_title}</Link>
  const greeting = `Hi ${actor.name}! Following up on "${n.target_title}" from CampusMarket.`
  const reply = actor.phone
    ? `https://wa.me/${actor.phone}?text=${encodeURIComponent(greeting)}`
    : `https://mail.google.com/mail/?${new URLSearchParams({
        view: 'cm', fs: '1', to: actor.email, su: `CampusMarket — ${n.target_title}`, body: greeting,
      })}`

  const isReport = n.type === 'report'
  const fromTeam = FROM_TEAM.has(n.type)
  let icon
  let text
  let action = null // the button on the right; contact taps get a reply link below
  if (isReport) {
    icon = 'triangle-alert'
    text = <>reported your {n.target_type} {item}{n.count > 1 && <span className="font-semibold text-coral"> ({n.count} reports)</span>}</>
    action = <Link to={href} className="btn-ghost btn-sm">View item</Link>
  } else if (n.type === 'removed') {
    icon = 'circle-x'
    // The item is gone, so its title isn't a link any more.
    text = <>removed your {n.target_type} <span className="font-semibold text-ink">{n.target_title}</span></>
  } else if (n.type === 'report_cleared') {
    icon = 'circle-check'
    text = <>reviewed the reports on your {n.target_type} {item}. No rules were broken, so it stays up.</>
    action = <Link to={href} className="btn-ghost btn-sm">View item</Link>
  } else if (n.type === 'held') {
    icon = 'circle-pause'
    text = <>paused your {n.target_type} {item} while we review reports about it. It's hidden from other students until then.</>
  } else if (n.type === 'access_request') {
    icon = 'key'
    text = <>requested access to {item}</>
    action = <Link to={`${href}#manage`} className="btn-accent btn-sm">Review request</Link>
  } else if (n.type === 'access_approved') {
    icon = 'check'
    text = <>approved your access to {item}</>
    action = <Link to={href} className="btn-accent btn-sm">Open resource</Link>
  } else if (n.type === 'access_denied') {
    icon = 'x'
    text = n.note === 'revoked'
      ? <>removed your access to {item}</>
      : <>declined your access request for {item}. If you've paid, message them, then request again.</>
    action = <Link to={href} className="btn-ghost btn-sm">View resource</Link>
  } else if (n.type === 'request_match') {
    icon = 'package'
    text = <>just listed {item}, which matches what you're looking for</>
    action = <Link to={href} className="btn-accent btn-sm">View {n.target_type}</Link>
  } else {
    icon = n.channel === 'whatsapp' ? 'whatsapp' : 'mail'
    text = n.target_type === 'request'
      ? <>replied to your request for {item} on {n.channel === 'whatsapp' ? 'WhatsApp' : 'email'}</>
      : <>opened {n.channel === 'whatsapp' ? 'WhatsApp' : 'email'} to message you about {item}</>
    action = (
      <a className={`${actor.phone ? 'btn btn-whatsapp' : 'btn-ghost'} btn-sm`} href={reply} target="_blank" rel="noopener noreferrer">
        {actor.phone && <WhatsAppIcon size={18} />}
        {actor.phone ? 'Reply on WhatsApp' : 'Reply by Email'}
      </a>
    )
  }

  // Notes: report / held / removed reasons, what a matched request asked for, or the requester's message. "revoked" is a flag, not text.
  let note = null
  if (n.note && n.type !== 'access_denied') {
    if (isReport) {
      note = <><span className="font-semibold">Reason:</span> {n.note}. Our team will review it; if something's wrong, edit or remove the item.</>
    } else if (n.type === 'held') {
      note = <><span className="font-semibold">Reported for:</span> {n.note}. You'll get a notification when it's reviewed; you can still edit it meanwhile.</>
    } else if (n.type === 'request_match') {
      note = <><span className="font-semibold">You asked for:</span> {n.note}</>
    } else if (n.type === 'removed') {
      note = <><span className="font-semibold">Reason:</span> {n.note}. Please follow the rules when you post again; repeated problems can get an account suspended.</>
    } else {
      note = <>“{n.note}”</>
    }
  }

  return (
    <div className={`mb-4 flex flex-wrap items-start gap-4 rounded-card border p-4 ${fresh ? 'border-brand/30 bg-brand-tint' : 'border-line'}`}>
      <div className="relative flex-none">
        {isReport ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-coral/10 text-coral" aria-hidden><Icon name="flag" /></div>
        ) : fromTeam ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white" aria-hidden>CM</div>
        ) : (
          <Avatar user={actor} size={44} className="bg-[#FFE4CF] font-display text-ink" />
        )}
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-paper" aria-hidden>{icon === 'whatsapp' ? <WhatsAppIcon size={13} className="text-whatsapp" /> : <Icon name={icon} size={12} stroke={2} />}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[15px] text-ink-soft">
          <span className="font-semibold text-ink">{actor.name}</span> {text}
        </p>
        {note && <p className="mt-1 break-words text-sm">{note}</p>}
        <p className="mt-1 text-[13px] text-ink-soft">
          {timeAgo(n.created_at)}
          {fresh && <span className="ml-2 rounded-pill bg-brand px-1.5 py-px text-[10.5px] font-bold text-white">New</span>}
          {n.type === 'contact' && <span className="ml-2">· check your {n.channel === 'whatsapp' ? 'WhatsApp' : 'inbox'}</span>}
        </p>
      </div>
      <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto sm:flex-none">
        {action}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss notification about ${n.target_title}`}
          title="Dismiss"
          className="flex h-10 w-10 items-center justify-center rounded-control text-ink-soft hover:bg-bg hover:text-ink"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  )
}
