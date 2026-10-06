import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { listingsApi, requestsApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useWishlist } from '../hooks/useWishlist.jsx'
import { useToast } from '../hooks/useToast.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import PostRequestModal from '../components/PostRequestModal.jsx'
import { formatPhone, timeAgo } from '../lib/format.js'

export default function Profile() {
  const { user, isSeller, isAdmin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const typeLabel = isAdmin ? 'Admin' : isSeller ? 'Seller' : 'Buyer'
  const details = [user.college, user.course, user.year].filter(Boolean)

  return (
    <div className="mx-auto max-w-[880px] px-6 py-9">
      {location.state?.needsSeller && !isSeller && (
        <p className="mb-5 rounded-xl bg-sun/25 px-4 py-3 text-[13.5px] text-[#946B00]">
          Selling is available to seller accounts. Switch below to start listing items.
        </p>
      )}

      <section className="mb-6 flex flex-wrap items-center gap-5 rounded-slab border border-line bg-paper p-6 md:p-8">
        <AvatarEditor />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold leading-tight">{user.name || 'Your account'}</h1>
            <span className={`badge ${isSeller ? 'bg-brand-tint text-brand' : 'bg-leaf/10 text-leaf'}`}>{typeLabel}</span>
          </div>
          <p className="mt-1 truncate text-[14px] text-ink-soft">
            {user.email}
            {user.phone && <> · {formatPhone(user.phone)}</>}
          </p>
          {details.length > 0 && <p className="mt-0.5 text-[13.5px] text-ink-faint">{details.join(' · ')}</p>}
          {!user.phone && isSeller && (
            <button onClick={() => setEditing(true)} className="mt-1.5 text-[13px] font-semibold text-brand hover:underline">
              + Add a contact number so buyers can WhatsApp you
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit Profile</button>
          <button className="btn-ghost btn-sm" onClick={() => logout().then(() => navigate('/'))}>Log Out</button>
        </div>
      </section>

      <EditProfileModal open={editing} onClose={() => setEditing(false)} />

      {isSeller ? <SellerSection user={user} /> : <BuyerSection />}

      <MyRequests />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <WishlistTile />
        <Tile
          to="/interests"
          emoji="✨"
          title="Your interests"
          body={user.interests?.length ? user.interests.join(', ') : 'Pick categories to get better recommendations.'}
          cta="Edit interests"
        />
      </div>
    </div>
  )
}

function EditProfileModal({ open, onClose }) {
  const { user, updateProfile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset the form from the latest saved profile every time the modal opens.
  if (open && !form) {
    setForm({
      name: user.name || '',
      phone: user.phone ? user.phone.replace(/^91/, '') : '',
      college: user.college || '',
      course: user.course || '',
      year: user.year || '',
    })
  }
  if (!open && form) {
    setForm(null)
    setError('')
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateProfile(form)
      toast('Profile updated')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      {form && (
        <form onSubmit={save}>
          <label className="field-label" htmlFor="pf-name">Name</label>
          <input id="pf-name" required className="field-input mb-4" value={form.name} onChange={set('name')} placeholder="Full name" />

          <label className="field-label" htmlFor="pf-phone">Contact number (WhatsApp)</label>
          <div className="mb-1 flex">
            <span className="flex items-center rounded-l-[11px] border-[1.5px] border-r-0 border-line bg-bg px-3 text-[14px] text-ink-soft">+91</span>
            <input
              id="pf-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={14}
              className="field-input rounded-l-none"
              value={form.phone}
              onChange={set('phone')}
              placeholder="10-digit mobile number"
            />
          </div>
          <p className="mb-4 text-[12px] text-ink-faint">Shown to buyers on your listings so they can reach you on WhatsApp.</p>

          <label className="field-label" htmlFor="pf-college">College</label>
          <input id="pf-college" required className="field-input mb-4" value={form.college} onChange={set('college')} />

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="pf-course">Course</label>
              <input id="pf-course" className="field-input" value={form.course} onChange={set('course')} placeholder="e.g. AI/ML" />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-year">Year</label>
              <input id="pf-year" className="field-input" value={form.year} onChange={set('year')} placeholder="e.g. 2nd Year" />
            </div>
          </div>

          {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
          <div className="flex gap-2.5">
            <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function MyRequests() {
  const toast = useToast()
  const { data, loading, refetch, setData } = useApi(() => requestsApi.mine(), [])
  const [posting, setPosting] = useState(false)
  const items = data || []

  async function remove(id) {
    const before = items
    setData(items.filter((r) => r.id !== id))
    try {
      await requestsApi.remove(id)
      toast('Request deleted')
    } catch (err) {
      setData(before)
      toast(err.message || 'Could not delete request')
    }
  }

  return (
    <section className="mt-6 rounded-slab border border-line bg-paper p-6 md:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold">My requests</h2>
          <p className="text-[13px] text-ink-faint">Things you've asked sellers for. Delete one once you've found it.</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setPosting(true)}>+ Post a Request</button>
      </div>

      {loading && <div className="skeleton h-16" />}

      {!loading && items.length === 0 && (
        <p className="rounded-card bg-bg px-4 py-5 text-center text-[14px] text-ink-soft">You haven't posted any requests yet.</p>
      )}

      {!loading && items.map((r) => (
        <div key={r.id} className="mb-2.5 flex items-start gap-3 rounded-card border border-line p-3.5">
          <div className="min-w-0 flex-1">
            <p className="break-words text-[15px] font-semibold">{r.product}</p>
            {r.description && <p className="mt-0.5 break-words text-[13.5px] text-ink-soft">{r.description}</p>}
            <p className="mt-1 text-[12px] text-ink-faint">Posted {timeAgo(r.created_at)}</p>
          </div>
          <button className="btn-danger btn-sm flex-none" onClick={() => remove(r.id)}>Delete</button>
        </div>
      ))}

      <PostRequestModal open={posting} onClose={() => setPosting(false)} onPosted={refetch} />
    </section>
  )
}

function AvatarEditor() {
  const { user, uploadAvatar, removeAvatar } = useAuth()
  const toast = useToast()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  async function run(action, done) {
    setBusy(true)
    try {
      await action()
      toast(done)
    } catch (err) {
      toast(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function onPick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again
    if (!file) return
    if (!file.type.startsWith('image/')) return toast('Please choose an image file')
    if (file.size > 5 * 1024 * 1024) return toast('Profile picture must be under 5 MB')
    run(() => uploadAvatar(file), 'Profile picture updated')
  }

  return (
    <div className="flex flex-none flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={user.avatar_url ? 'Change profile picture' : 'Add profile picture'}
        className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <Avatar user={user} size={72} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/55 text-[11.5px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? '…' : user.avatar_url ? 'Change' : 'Add photo'}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-ink text-white" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPick} />
      {user.avatar_url && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(removeAvatar, 'Profile picture removed')}
          className="text-[12px] font-medium text-ink-faint hover:text-coral"
        >
          Remove
        </button>
      )}
    </div>
  )
}

function SellerSection({ user }) {
  const { data, loading } = useApi(
    () => listingsApi.list({ seller_id: user.id, include_sold: true }),
    [user.id]
  )
  const items = data?.items || []
  const count = (status) => items.filter((l) => l.status === status).length
  const stats = [
    { label: 'Active', value: count('available') },
    { label: 'Reserved', value: count('reserved') },
    { label: 'Sold', value: count('sold') },
  ]

  return (
    <section className="rounded-slab border border-line bg-paper p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[19px] font-semibold">Your shop</h2>
        <div className="flex gap-2">
          <Link to="/dashboard" className="btn-ghost btn-sm">My Listings</Link>
          <Link to="/sell" className="btn-accent btn-sm">Sell an Item</Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-bg px-4 py-3.5">
            <p className="font-display text-[26px] font-bold leading-none">{loading ? '–' : s.value}</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function BuyerSection() {
  const { becomeSeller } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function upgrade() {
    setBusy(true)
    try {
      await becomeSeller()
      toast('You can now sell on CampusMarket')
      navigate('/sell')
    } catch (err) {
      toast(err.message || 'Could not switch account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-slab border border-line bg-paper p-6 md:p-8">
      <div>
        <h2 className="text-[19px] font-semibold">Want to sell something?</h2>
        <p className="mt-1 max-w-md text-[14px] text-ink-soft">
          Your account is set up for buying. Switch to a seller account to list items. You'll still be able to buy.
        </p>
      </div>
      <button className="btn-accent" disabled={busy} onClick={upgrade}>
        {busy ? 'Switching…' : 'Become a Seller'}
      </button>
    </section>
  )
}

function WishlistTile() {
  const { count } = useWishlist()
  return (
    <Tile
      to="/wishlist"
      emoji="♡"
      title="My Wishlist"
      body={count ? `${count} saved item${count === 1 ? '' : 's'}` : 'Nothing saved yet.'}
      cta="View wishlist"
    />
  )
}

function Tile({ to, emoji, title, body, cta }) {
  return (
    <Link to={to} className="group block rounded-card border border-line bg-paper p-5 transition hover:-translate-y-[2px] hover:shadow-lift">
      <span className="mb-2 block text-[22px]" aria-hidden>{emoji}</span>
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <p className="mt-1 line-clamp-2 text-[13.5px] text-ink-soft">{body}</p>
      <p className="mt-3 text-[13.5px] font-semibold text-brand group-hover:underline">{cta} →</p>
    </Link>
  )
}
