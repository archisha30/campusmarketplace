import ListingCard from './ListingCard.jsx'
import { useRecommendations } from '../hooks/useRecommendations.js'

// Cold-start handling is the point here: a first-time visitor with no browsing
// history still sees a full row (newest/best-matched-to-campus listings), just
// with honest copy instead of a fake "personalized" claim.
export default function RecommendedForYou({ excludeId, title = 'Recommended for you ‼️' }) {
  const { items, personalized, loading } = useRecommendations({ excludeId })

  if (!loading && items.length === 0) return null

  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-[19px] font-bold">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-faint">
          {personalized
            ? 'Based on what you\'ve been browsing.'
            : 'Popular picks to get you started — this tailors itself as you browse.'}
        </p>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[236px] w-[220px] flex-none" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {items.map((l) => (
            <div key={l.id} className="w-[220px] flex-none">
              <ListingCard listing={l} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
