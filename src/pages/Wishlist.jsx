import { useWishlist } from '../hooks/useWishlist.jsx'
import ListingCard from '../components/ListingCard.jsx'
import ResourceCard from '../components/ResourceCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonGrid } from '../components/SkeletonCard.jsx'

export default function Wishlist() {
  // Saved on the server (current price and status), so it's the same on every device.
  const { items: listings, resources, count, loading } = useWishlist()

  return (
    <div className="wrap py-9">
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
          emoji="♡"
          title="Your wishlist is empty"
          body="Tap the heart on any listing or study resource to save it here for later."
          actionLabel="Browse Marketplace"
          actionTo="/marketplace"
        />
      ) : (
        <>
          {listings.length > 0 && (
            <section className="mb-10">
              {resources.length > 0 && <h2 className="mb-4 text-[20px] font-semibold">Marketplace</h2>}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            </section>
          )}
          {resources.length > 0 && (
            <section>
              <h2 className="mb-4 text-[20px] font-semibold">Study resources</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((r) => <ResourceCard key={r.id} r={r} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
