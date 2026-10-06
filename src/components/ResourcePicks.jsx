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
      className={panel ? 'mb-8 rounded-[18px] border border-brand/15 bg-brand-tint p-3.5 md:p-4' : 'mt-12'}
    >
      <h2 className={panel ? 'text-[18px] font-bold' : 'text-[19px] font-bold'}>{title}</h2>
      <p className="mb-4 mt-1 text-[13px] text-ink-soft">{reason}</p>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[280px] w-[220px] flex-none" />)}
        </div>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-1">
          {items.map((r) => (
            <div key={r.id} className="w-[220px] flex-none snap-start">
              <ResourceCard r={r} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
