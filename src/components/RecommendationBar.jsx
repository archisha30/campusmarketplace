import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ListingCard from './ListingCard.jsx'
import { useRecommendations } from '../hooks/useRecommendations.js'
import { useAuth } from '../hooks/useAuth.jsx'

// The marketplace's top section. It sits in its own tinted panel so it reads as
// "picked for you", separate from the full browse-and-filter list underneath.
export default function RecommendationBar() {
  const { user } = useAuth()
  // With interests chosen, only those categories are shown (strict), never filler from others.
  const { items, personalized, loading } = useRecommendations({ strict: true })
  const interests = user?.interests || []

  const scroller = useRef(null)
  const [edge, setEdge] = useState({ atStart: true, atEnd: true })

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setEdge({
      atStart: el.scrollLeft <= 2,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, items, loading])

  function page(direction) {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const empty = !loading && items.length === 0
  if (empty && interests.length === 0) return null

  return (
    <section aria-labelledby="picked-for-you" className="mb-8 w-full max-w-[780px] rounded-[18px] border border-brand/15 bg-brand-tint p-3.5 md:p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="picked-for-you" className="text-[18px] font-bold">Picked for you</h2>
          {interests.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-soft">Based on your interests</span>
              {interests.map((c) => (
                <span key={c} className="rounded-pill bg-paper px-2.5 py-0.5 text-[12px] font-medium text-brand-deep">
                  {c}
                </span>
              ))}
              <Link to="/interests" className="text-[13px] font-semibold text-brand hover:underline">Edit</Link>
            </div>
          ) : (
            <p className="mt-1.5 text-[13px] text-ink-soft">
              {personalized ? 'Based on what you\'ve been browsing.' : 'Popular on your campus.'}{' '}
              <Link to="/interests" className="font-semibold text-brand hover:underline">Choose your interests</Link>{' '}
              to make this yours.
            </p>
          )}
        </div>

        <div className={`hidden flex-none gap-1.5 ${empty ? '' : 'md:flex'}`}>
          <button
            type="button"
            aria-label="Previous picks"
            onClick={() => page(-1)}
            disabled={edge.atStart}
            className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-line bg-paper text-lg transition hover:border-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next picks"
            onClick={() => page(1)}
            disabled={edge.atEnd}
            className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-line bg-paper text-lg transition hover:border-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line"
          >
            ›
          </button>
        </div>
      </div>

      {empty ? (
        <p className="rounded-card bg-paper px-4 py-5 text-[13.5px] text-ink-soft">
          Nothing in {interests.join(', ')} right now. New listings in your interests will show up here.
        </p>
      ) : loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[176px] w-[176px] flex-none" />
          ))}
        </div>
      ) : (
        <div ref={scroller} onScroll={measure} className="flex snap-x gap-3 overflow-x-auto pb-1">
          {items.map((l) => {
            const matches = interests.length > 1 && interests.includes(l.category)
            return (
              <div key={l.id} className="w-[176px] flex-none snap-start">
                <ListingCard listing={l} compact />
                {matches && (
                  <p className="mt-1.5 truncate px-1 text-[12px] font-medium text-brand-deep">
                    Matches {l.category}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
