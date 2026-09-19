import { Link } from 'react-router-dom'
import { TypeBadge, VerifiedBadge, StatusPill } from './Badge.jsx'
import { formatPrice } from '../lib/format.js'

export default function ListingCard({ listing }) {
  const { id, title, price, condition, listing_type, status, art, seller } = listing

  return (
    <Link
      to={`/listing/${id}`}
      className="group block overflow-hidden rounded-card border border-line bg-paper transition hover:-translate-y-[3px] hover:shadow-lift"
    >
      <div
        className="relative flex h-[130px] items-center justify-center text-[44px]"
        style={{ background: art?.bg || '#EFEFEC' }}
      >
        <span className="absolute left-2.5 top-2.5"><TypeBadge type={listing_type} /></span>
        <button
          type="button"
          aria-label="Save to favourites"
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow"
        >
          ♡
        </button>
        <span aria-hidden>{art?.emoji || '📦'}</span>
      </div>

      <div className="p-3.5">
        <h3 className="text-[14.5px] font-semibold leading-snug">{title}</h3>
        <p className="mt-1 font-display text-[17px] font-bold">{formatPrice(price)}</p>
        <p className="mt-1 text-[12.5px] text-ink-faint">{condition} · {seller.campus}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VerifiedBadge />
          <StatusPill status={status} />
        </div>
      </div>
    </Link>
  )
}
