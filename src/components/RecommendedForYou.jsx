import ListingCard from './ListingCard.jsx'
import Reveal from './Reveal.jsx'
import { SkeletonGrid } from './SkeletonCard.jsx'
import { useRecommendations } from '../hooks/useRecommendations.js'

// Cold-start handling is the point here: a first-time visitor with no browsing
// history still sees a full row (newest/best-matched-to-campus listings), just
// with honest copy instead of a fake "personalized" claim.
export default function RecommendedForYou({ excludeId, title = 'Recommended for you' }) {
  const { items, personalized, loading } = useRecommendations({ excludeId })

  if (!loading && items.length === 0) return null

  return (
    <section className="mb-10">
      <div className="mb-8">
        <h2 className="text-[26px] md:text-[32px]">{title}</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {personalized
            ? 'Based on your interests and what you\'ve been browsing.'
            : 'Popular picks to get you started — this tailors itself as you browse.'}
        </p>
      </div>

      {loading ? (
        <SkeletonGrid count={4} />
      ) : (
        <div className="-mx-2 flex snap-x scroll-px-2 gap-6 overflow-x-auto px-2 py-2">
          {items.map((l, i) => (
            <Reveal key={l.id} i={i} className="w-[220px] flex-none snap-start md:w-[256px]">
              <ListingCard listing={l} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}
