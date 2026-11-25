import { useWishlist } from '../hooks/useWishlist.jsx'
import ListingCard from '../components/ListingCard.jsx'
import ResourceCard from '../components/ResourceCard.jsx'
import Reveal from '../components/Reveal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { CARD_GRID, SkeletonGrid } from '../components/SkeletonCard.jsx'

export default function Wishlist() {
  // Saved on the server (current price and status), so it's the same on every device.
  const { items: listings, resources, count, loading } = useWishlist()

  return (
    <div className="wrap py-8 md:py-12">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="page-title">My Wishlist</h1>
        {count > 0 && (
          <span className="text-[14.5px] text-ink-faint">
            {count} saved item{count === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading && count === 0 ? (
        <SkeletonGrid count={4} />
      ) : count === 0 ? (
        <EmptyState
          icon="heart"
          title="Your wishlist is empty"
          body="Tap the heart on any listing or study resource to save it here for later."
          actionLabel="Browse Marketplace"
          actionTo="/marketplace"
        />
      ) : (
        <>
          {listings.length > 0 && (
            <section className="mb-10">
              {resources.length > 0 && <h2 className="mb-4 text-2xl">Marketplace</h2>}
              <div className={CARD_GRID}>
                {listings.map((l, i) => <Reveal key={l.id} i={i}><ListingCard listing={l} /></Reveal>)}
              </div>
            </section>
          )}
          {resources.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl">Study resources</h2>
              <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((r, i) => <Reveal key={r.id} i={i}><ResourceCard r={r} /></Reveal>)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
