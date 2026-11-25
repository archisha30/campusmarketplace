import { Link } from 'react-router-dom'
import { StatusPill, TypeBadge, VerifiedBadge } from './Badge.jsx'
import { CategoryArt, CategoryLabel } from './CategoryTile.jsx'
import HeartButton from './HeartButton.jsx'
import PriceTag from './PriceTag.jsx'
import { foodTempLabel, formatDay, isExpired, listedOn } from '../lib/format.js'
import { useWishlist } from '../hooks/useWishlist.jsx'
import { useToast } from '../hooks/useToast.jsx'

// A listing in any grid, with its wishlist heart.
export default function ListingCard({ listing, compact = false }) {
  const { isSaved, toggle } = useWishlist()
  const toast = useToast()
  const { id, images } = listing
  return (
    <ListingCardView
      to={`/listing/${id}`}
      listing={listing}
      compact={compact}
      // The small copy made at upload when there is one (much lighter than the full photo).
      photo={listing.thumbnail || (images && images.length > 0 ? images[0] : null)}
      heart={
        <HeartButton
          saved={isSaved(id)}
          compact={compact}
          onToggle={() => toast(toggle(listing) ? 'Saved to your wishlist' : 'Removed from your wishlist')}
        />
      }
    />
  )
}

// How a listing card looks, without the wishlist: also used on the home page (teasers) and for
// the preview while posting. Without `to` it isn't a link.
export function ListingCardView({ listing, photo, heart = null, to, state, compact = false }) {
  const { title, price, condition, listing_type, status, seller, category } = listing
  const sold = status === 'sold'
  const meta = (listing.food_temp
    ? [foodTempLabel(listing), listing.expiry_date && (isExpired(listing) ? 'Expired' : `Best before ${formatDay(listing.expiry_date)}`)]
    : [condition, seller?.campus]
  ).filter(Boolean).join(' · ')
  const Tag = to ? Link : 'div'

  return (
    <Tag {...(to ? { to, state } : {})} className={`flex min-w-0 flex-col ${compact ? 'gap-2' : 'gap-4'}`}>
      {/* Sold items stay in the marketplace, outlined in red so they're obviously gone. */}
      <div className={`relative aspect-[4/3] rounded-card ${sold ? 'ring-2 ring-coral' : ''}`}>
        <CategoryArt
          category={category}
          src={photo}
          alt={title}
          iconSize={compact ? 32 : 48}
          className={`rounded-card ${sold ? 'opacity-60' : ''}`}
        />
        {listing_type && <span className="absolute left-2 top-2"><TypeBadge type={listing_type} /></span>}
        {sold && <span className="absolute bottom-2 left-2"><StatusPill status={status} /></span>}
        {heart}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <CategoryLabel category={category} className={compact ? 'text-[13px]' : ''} />
        {price == null ? (
          <p className="font-display text-2xl font-semibold text-ink-soft">₹ –</p> // still being typed (post preview)
        ) : (
          <PriceTag price={price} mrp={listing.mrp} listingType={listing_type} rentDays={listing.rent_days} size={compact ? 'sm' : 'md'} />
        )}
        <h3 className={`truncate font-sans font-medium tracking-normal ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
        {meta && <p className={`truncate text-ink-soft ${compact ? 'text-[13px]' : 'text-sm'}`}>{meta}</p>}
        {listing.created_at && (
          <p className={`text-ink-soft ${compact ? 'text-[13px]' : 'text-sm'}`}>{listedOn(listing.created_at)}</p>
        )}
        {/* Home page teasers come without the seller, so without this row too. */}
        {!compact && seller && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <VerifiedBadge pill />
            <StatusPill status={status} />
          </div>
        )}
      </div>
    </Tag>
  )
}
