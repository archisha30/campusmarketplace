import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal.jsx'
import PriceTag from './PriceTag.jsx'
import { requestsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { trackEvent } from '../lib/analytics.js'
import { formatPrice } from '../lib/format.js'

const MAX = 70

export default function PostRequestModal({ open, onClose, onPosted }) {
  const toast = useToast()
  const [product, setProduct] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Listings and resources already up that match the request, shown after posting it.
  const [matches, setMatches] = useState(null)

  function close() {
    setError('')
    setMatches(null)
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    if (!product.trim()) return setError("Tell sellers what you're looking for")
    setBusy(true)
    setError('')
    try {
      const posted = await requestsApi.create({ product: product.trim(), description: description.trim() })
      onPosted?.()
      setProduct('')
      setDescription('')
      const listings = posted.matches || []
      const resources = posted.resource_matches || []
      if (listings.length || resources.length) {
        toast('Request sent to sellers')
        trackEvent('request_matched', { matches: listings.length, resource_matches: resources.length })
        setMatches({ listings, resources })
      } else {
        toast("Request sent to sellers. We'll let you know when a match is listed.")
        onClose()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (matches) {
    return (
      <Modal open={open} onClose={close} title="Already on CampusMarket">
        <p className="-mt-2 mb-4 text-[13.5px] text-ink-soft">
          Your request is posted, and we'll tell you if more turn up. Meanwhile, these might be what you need:
        </p>
        <ul className="mb-5 max-h-[55vh] space-y-2 overflow-y-auto">
          {matches.listings.map((l) => (
            <MatchRow
              key={`l${l.id}`}
              to={`/listing/${l.id}`}
              onOpen={close}
              title={l.title}
              thumb={l.images?.[0]}
              fallback={l.art?.emoji || '📦'}
              bg={l.art?.bg}
            >
              <PriceTag price={l.price} mrp={l.mrp} listingType={l.listing_type} rentDays={l.rent_days} size="sm" />
            </MatchRow>
          ))}
          {matches.resources.map((r) => (
            <MatchRow
              key={`r${r.id}`}
              to={`/resources/${r.id}`}
              onOpen={close}
              title={r.title}
              thumb={r.thumbnail_url}
              fallback={r.copy_type === 'hard' ? '📗' : '📄'}
            >
              <span className="block text-[12.5px] text-ink-faint">
                Resource Hub · {r.subject} · {r.offer_type === 'free' ? 'Free' : formatPrice(r.price)}
              </span>
            </MatchRow>
          ))}
        </ul>
        <button type="button" className="btn-ghost w-full" onClick={close}>Done</button>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={close} title="Post a Request">
      <form onSubmit={submit}>
        <p className="-mt-2 mb-4 text-[13.5px] text-ink-soft">Sellers on your campus get notified and can reach out to you. If a matching item is listed later, we'll let you know.</p>

        <Field
          id="req-product"
          label="What are you looking for?"
          value={product}
          onChange={setProduct}
          placeholder="e.g. Casio fx-991CW calculator"
          required
        />
        <Field
          id="req-description"
          label="One-line description"
          value={description}
          onChange={setDescription}
          placeholder="e.g. Need it for tomorrow's exam, can rent too"
        />

        {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
        <div className="flex gap-2.5">
          <button type="button" className="btn-ghost flex-1" onClick={close}>Cancel</button>
          <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Posting…' : 'Post Request'}</button>
        </div>
      </form>
    </Modal>
  )
}

function MatchRow({ to, onOpen, title, thumb, fallback, bg, children }) {
  return (
    <li>
      <Link to={to} onClick={onOpen} className="flex items-center gap-3 rounded-card border border-line p-2 transition hover:shadow-lift">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-[22px]"
          style={{ background: bg || '#EFEFEC' }}
        >
          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover object-top" /> : <span aria-hidden>{fallback}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{title}</span>
          {children}
        </span>
        <span className="text-[13px] font-semibold text-ink-soft">View</span>
      </Link>
    </li>
  )
}

function Field({ id, label, value, onChange, placeholder, required }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between">
        <label className="field-label" htmlFor={id}>{label}</label>
        <span className={`text-[12px] tabular-nums ${value.length >= MAX ? 'text-coral' : 'text-ink-faint'}`}>
          {value.length}/{MAX}
        </span>
      </div>
      <input
        id={id}
        required={required}
        maxLength={MAX}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, ' '))}
        placeholder={placeholder}
      />
    </div>
  )
}
