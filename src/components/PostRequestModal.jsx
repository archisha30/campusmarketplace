import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal.jsx'
import PriceTag from './PriceTag.jsx'
import { requestsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { trackEvent } from '../lib/analytics.js'
import { formatPrice } from '../lib/format.js'
import Icon from './Icon.jsx'
import { CategoryArt } from './CategoryTile.jsx'

const PRODUCT_MAX = 70
const DESCRIPTION_MAX = 200

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
        <p className="-mt-2 mb-6 text-[15px] leading-relaxed text-ink-soft">
          Your request is posted, and we'll tell you if more turn up. Meanwhile, these might be what you need:
        </p>
        <ul className="mb-5 max-h-[55vh] space-y-2 overflow-y-auto">
          {matches.listings.map((l) => (
            <MatchRow
              key={`l${l.id}`}
              to={`/listing/${l.id}`}
              onOpen={close}
              title={l.title}
              thumb={l.thumbnail || l.images?.[0]}
              category={l.category}
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
    <Modal open={open} onClose={close} title="Looking for something?">
      <form onSubmit={submit}>
        <p className="-mt-2 mb-6 text-[15px] leading-relaxed text-ink-soft">Sellers on your campus get notified and can reach out to you. If a matching item is listed later, we'll let you know.</p>

        <Field
          id="req-product"
          label="What do you need?"
          value={product}
          onChange={setProduct}
          placeholder="e.g. Casio fx-991CW calculator"
          max={PRODUCT_MAX}
          required
        />
        <Field
          id="req-description"
          label="Anything else? (optional)"
          value={description}
          onChange={setDescription}
          placeholder="e.g. Need it for Tuesday's exam, any condition, under ₹800, can rent too"
          max={DESCRIPTION_MAX}
          multiline
        />

        {error && <p className="mb-4 text-sm text-coral">{error}</p>}
        <div className="flex gap-4">
          <button type="button" className="btn-ghost flex-1" onClick={close}>Cancel</button>
          <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Posting…' : 'Post request'}</button>
        </div>
      </form>
    </Modal>
  )
}

function MatchRow({ to, onOpen, title, thumb, category, children }) {
  return (
    <li>
      <Link to={to} onClick={onOpen} className="no-lift flex items-center gap-3 rounded-control border border-line p-2 hover:border-ink">
        <span className="block h-12 w-12 flex-none overflow-hidden rounded-control bg-tile">
          {category
            ? <CategoryArt category={category} src={thumb} iconSize={24} />
            : thumb
              ? <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
              : <span className="flex h-full w-full items-center justify-center"><Icon name="file-text" size={22} /></span>}
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

function Field({ id, label, value, onChange, placeholder, max, required, multiline }) {
  const Box = multiline ? 'textarea' : 'input' // both stay one line of text: line breaks become spaces
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between">
        <label className="field-label" htmlFor={id}>{label}</label>
        <span className={`text-[13px] tabular-nums ${value.length >= max ? 'text-coral' : 'text-ink-faint'}`}>
          {value.length}/{max}
        </span>
      </div>
      <Box
        id={id}
        required={required}
        maxLength={max}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, ' '))}
        placeholder={placeholder}
      />
    </div>
  )
}
