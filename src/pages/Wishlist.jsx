import { useWishlist } from '../hooks/useWishlist.jsx'
import ListingCard from '../components/ListingCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonGrid } from '../components/SkeletonCard.jsx'

export default function Wishlist() {
  // Saved on the server (current price and status), so it's the same on every device.
  const { items: listings, loading } = useWishlist()

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="text-[30px] font-bold">My Wishlist</h1>
        {listings.length > 0 && (
          <span className="text-[14.5px] text-ink-faint">
            {listings.length} saved item{listings.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading && listings.length === 0 ? (
        <SkeletonGrid count={4} />
      ) : listings.length === 0 ? (
        <EmptyState
          emoji="♡"
          title="Your wishlist is empty"
          body="Tap the heart on any listing to save it here for later."
          actionLabel="Browse Marketplace"
          actionTo="/marketplace"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  )
}
