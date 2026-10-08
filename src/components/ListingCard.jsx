import { Link } from 'react-router-dom'
import { TypeBadge, VerifiedBadge, StatusPill } from './Badge.jsx'
import { foodTempLabel, formatDay, formatPrice, isExpired } from '../lib/format.js'
import { useWishlist } from '../hooks/useWishlist.jsx'
import { useToast } from '../hooks/useToast.jsx'

export default function ListingCard({ listing, compact = false }) {
  const { id, title, price, condition, listing_type, status, art, seller, images } = listing
  const { isSaved, toggle } = useWishlist()
  const toast = useToast()
  const saved = isSaved(id)
  const thumbnail = images && images.length > 0 ? images[0] : null

  return (
    <Link
      to={`/listing/${id}`}
      className="group block overflow-hidden rounded-card border border-line bg-paper transition hover:-translate-y-[3px] hover:shadow-lift"
    >
      <div
        className={`relative flex items-center justify-center overflow-hidden ${compact ? 'h-[96px] text-[34px]' : 'h-[130px] text-[44px]'}`}
        style={{ background: art?.bg || '#EFEFEC' }}
      >
        <span className="absolute left-2.5 top-2.5"><TypeBadge type={listing_type} /></span>
        <button
          type="button"
          aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          aria-pressed={saved}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toast(toggle(listing) ? 'Saved to your wishlist' : 'Removed from your wishlist')
          }}
          className={`absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow transition hover:scale-110 ${saved ? 'text-coral' : 'text-ink'}`}
        >
          {saved ? '♥' : '♡'}
        </button>
        {thumbnail ? (
          <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{art?.emoji || '📦'}</span>
        )}
      </div>

      <div className={compact ? 'p-3' : 'p-3.5'}>
        <h3 className={`font-semibold leading-snug ${compact ? 'truncate text-[13.5px]' : 'text-[14.5px]'}`}>{title}</h3>
        <p className={`mt-1 font-display font-bold ${compact ? 'text-[15px]' : 'text-[17px]'}`}>{formatPrice(price)}</p>
        <p className={`mt-1 text-ink-faint ${compact ? 'truncate text-[12px]' : 'text-[12.5px]'}`}>
          {(listing.food_temp
            ? [foodTempLabel(listing), listing.expiry_date && (isExpired(listing) ? 'Expired' : `Best before ${formatDay(listing.expiry_date)}`)]
            : [condition, seller?.campus]
          ).filter(Boolean).join(' · ')}
        </p>
        {!compact && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <VerifiedBadge />
            <StatusPill status={status} />
          </div>
        )}
      </div>
    </Link>
  )
}
