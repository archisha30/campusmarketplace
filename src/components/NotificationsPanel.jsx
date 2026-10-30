import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import Modal from './Modal.jsx'
import { useNotifications } from '../hooks/useNotifications.js'
import { useToast } from '../hooks/useToast.jsx'
import { timeAgo } from '../lib/format.js'

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
    <section id="notifications" className="mb-6 scroll-mt-24 rounded-slab border border-line bg-paper p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold">
          Notifications
          {fresh > 0 && (
            <span className="rounded-pill bg-coral px-2 py-0.5 text-[11.5px] font-bold text-white">{fresh} new</span>
          )}
        </h2>
        {!loading && items.length > 0 && (
          <button className="btn-ghost btn-sm" onClick={() => setConfirmClear(true)}>Clear all</button>
        )}
      </div>
      {blurb && <p className="-mt-2 mb-4 text-[13px] text-ink-faint">{blurb}</p>}

      {loading && <div className="skeleton h-20" />}

      {!loading && items.length === 0 && (
        <p className="rounded-card bg-bg px-4 py-6 text-center text-[14px] text-ink-soft">{empty}</p>
      )}

      {!loading && shown.map((n) => <NotificationRow key={n.id} n={n} onDismiss={() => onDismiss(n.id)} />)}

      {!loading && hidden > 0 && (
        <button
          className="mt-1 text-[13.5px] font-semibold text-brand hover:underline"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less ▲' : `Show ${hidden} more ▼`}
        </button>
      )}

      <Modal open={confirmClear} onClose={() => !clearing && setConfirmClear(false)} title="Clear all notifications?">
        <p className="text-[14px] text-ink-soft">This removes all {items.length} notifications. It can't be undone.</p>
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
  const href = n.target_type === 'listing' ? `/listing/${n.target_id}` : `/resources/${n.target_id}`
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
    icon = '⚠️'
    text = <>reported your {n.target_type} {item}{n.count > 1 && <span className="font-semibold text-coral"> ({n.count} reports)</span>}</>
    action = <Link to={href} className="btn-ghost btn-sm">View item</Link>
  } else if (n.type === 'removed') {
    icon = '🛑'
    // The item is gone, so its title isn't a link any more.
    text = <>removed your {n.target_type} <span className="font-semibold text-ink">{n.target_title}</span></>
  } else if (n.type === 'report_cleared') {
    icon = '✅'
    text = <>reviewed the reports on your {n.target_type} {item}. No rules were broken, so it stays up.</>
    action = <Link to={href} className="btn-ghost btn-sm">View item</Link>
  } else if (n.type === 'held') {
    icon = '⏸️'
    text = <>paused your {n.target_type} {item} while we review reports about it. It's hidden from other students until then.</>
  } else if (n.type === 'access_request') {
    icon = '🔑'
    text = <>requested access to {item}</>
    action = <Link to={`${href}#manage`} className="btn-accent btn-sm">Review request</Link>
  } else if (n.type === 'access_approved') {
    icon = '✓'
    text = <>approved your access to {item}</>
    action = <Link to={href} className="btn-accent btn-sm">Open resource</Link>
  } else if (n.type === 'access_denied') {
    icon = '✕'
    text = n.note === 'revoked'
      ? <>removed your access to {item}</>
      : <>declined your access request for {item}. If you've paid, message them, then request again.</>
    action = <Link to={href} className="btn-ghost btn-sm">View resource</Link>
  } else {
    icon = n.channel === 'whatsapp' ? '💬' : '✉️'
    text = <>opened {n.channel === 'whatsapp' ? 'WhatsApp' : 'email'} to message you about {item}</>
    action = (
      <a className="btn-ghost btn-sm" href={reply} target="_blank" rel="noopener noreferrer">
        {actor.phone ? 'Reply on WhatsApp' : 'Reply by Email'}
      </a>
    )
  }

  // Notes: report / held / removed reasons, or the requester's message. "revoked" is a flag, not text.
  let note = null
  if (n.note && n.type !== 'access_denied') {
    if (isReport) {
      note = <><span className="font-semibold">Reason:</span> {n.note}. Our team will review it; if something's wrong, edit or remove the item.</>
    } else if (n.type === 'held') {
      note = <><span className="font-semibold">Reported for:</span> {n.note}. You'll get a notification when it's reviewed; you can still edit it meanwhile.</>
    } else if (n.type === 'removed') {
      note = <><span className="font-semibold">Reason:</span> {n.note}. Please follow the rules when you post again; repeated problems can get an account suspended.</>
    } else {
      note = <>“{n.note}”</>
    }
  }

  return (
    <div className={`mb-2.5 flex flex-wrap items-start gap-3.5 rounded-card border p-3.5 ${fresh ? 'border-brand/30 bg-brand-tint/50' : 'border-line'}`}>
      <div className="relative flex-none">
        {isReport ? (
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-coral/15 text-[16px]" aria-hidden>🚩</div>
        ) : fromTeam ? (
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white" aria-hidden>CM</div>
        ) : (
          <Avatar user={actor} size={38} className="bg-sun font-display text-ink" />
        )}
        <span className="absolute -bottom-1 -right-1 text-[14px]" aria-hidden>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[14px] text-ink-soft">
          <span className="font-semibold text-ink">{actor.name}</span> {text}
        </p>
        {note && <p className="mt-1 break-words text-[13.5px]">{note}</p>}
        <p className="mt-1 text-[12px] text-ink-faint">
          {timeAgo(n.created_at)}
          {fresh && <span className="ml-2 rounded-pill bg-brand px-1.5 py-px text-[10.5px] font-bold text-white">New</span>}
          {n.type === 'contact' && <span className="ml-2">· check your {n.channel === 'whatsapp' ? 'WhatsApp' : 'inbox'}</span>}
        </p>
      </div>
      <div className="flex flex-none flex-wrap gap-2">
        {action}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss notification about ${n.target_title}`}
          title="Dismiss"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-ink-faint hover:bg-bg hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  )
}
