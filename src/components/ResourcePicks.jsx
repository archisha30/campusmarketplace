import ResourceCard from './ResourceCard.jsx'
import { useResourceRecommendations } from '../hooks/useRecommendations.js'
import { yearLabel } from '../lib/resources.js'

// Resource Hub recommendations. "panel" sits at the top of the Resource Hub (like the
// marketplace's "Picked for you"); "row" is the "More like this" strip on a resource page.
export default function ResourcePicks({ excludeId, title = 'Picked for you', variant = 'panel' }) {
  const { items, personalized, year, loading } = useResourceRecommendations({ excludeId })

  if (!loading && items.length === 0) return null

  const reason = personalized
    ? `Based on the subjects you've been opening${year ? `, with ${yearLabel(year).toLowerCase()} material first` : ''}.`
    : year
      ? `${yearLabel(year)} material first. This tailors itself as you open resources.`
      : 'Newest on your campus. This tailors itself as you open resources.'

  const panel = variant === 'panel'
  return (
    <section
      aria-label={title}
      className={panel ? 'card mb-12 p-4 md:p-6' : 'mt-section-sm'}
    >
      <h2 className={panel ? 'text-xl' : 'text-[26px] md:text-[32px]'}>{title}</h2>
      <p className="mb-4 mt-2 text-sm text-ink-soft">{reason}</p>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[260px] w-[260px] flex-none" />)}
        </div>
      ) : (
        <div className="-mx-2 flex snap-x scroll-px-2 gap-6 overflow-x-auto px-2 py-2">
          {items.map((r) => (
            <div key={r.id} className="w-[260px] flex-none snap-start">
              <ResourceCard r={r} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
