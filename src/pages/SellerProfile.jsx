import { useParams } from 'react-router-dom'
import Avatar from '../components/Avatar.jsx'
import { VerifiedBadge } from '../components/Badge.jsx'
import Reveal from '../components/Reveal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ListingCard from '../components/ListingCard.jsx'
import ResourceCard from '../components/ResourceCard.jsx'
import { CARD_GRID, SkeletonGrid } from '../components/SkeletonCard.jsx'
import { useApi } from '../hooks/useApi.js'
import { sellersApi } from '../services/api.js'

// "Aug 2026" from an API timestamp.
function monthYear(iso) {
  if (!iso) return ''
  const s = String(iso)
  const t = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`)
  return t.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// A student's public page: who they are, how long they've been here, how much they've sold and
// what they have up right now, so buyers can judge who they're dealing with.
export default function SellerProfile() {
  const { id } = useParams()
  const { data: s, loading, error } = useApi(() => sellersApi.get(id), [id])

  if (loading) {
    return (
      <div className="wrap py-8 md:py-12">
        <div className="skeleton mb-8 h-[120px]" />
        <SkeletonGrid count={4} />
      </div>
    )
  }
  if (error || !s) {
    return (
      <div className="wrap py-8 md:py-12">
        <EmptyState icon="search-x" title="Student not found" body="This account doesn't exist or isn't active any more." actionLabel="Browse Marketplace" actionTo="/marketplace" />
      </div>
    )
  }

  const nothingUp = s.listings.length === 0 && s.resources.length === 0
  return (
    <div className="wrap py-8 md:py-12">
      <section className="mb-8 flex flex-wrap items-center gap-5 rounded-slab border border-line bg-paper p-6 md:p-8">
        <Avatar user={s} size={72} className="bg-sun font-display text-[26px] text-ink" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[26px] font-bold">
            <span className="break-words">{s.name}</span> <VerifiedBadge />
          </h1>
          <p className="mt-0.5 text-[14px] text-ink-soft">
            {[s.college, s.joined_at && `Joined ${monthYear(s.joined_at)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <dl className="flex gap-3">
          <Stat value={s.sold_count} label={s.sold_count === 1 ? 'item sold' : 'items sold'} />
          <Stat value={s.listings.length + s.resources.length} label="up now" />
        </dl>
      </section>

      {nothingUp && (
        <EmptyState icon="package" title="Nothing up right now" body={`${s.name} doesn't have anything for sale or to share at the moment.`} actionLabel="Browse Marketplace" actionTo="/marketplace" />
      )}

      {s.listings.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-2xl">For sale & rent</h2>
          <div className={CARD_GRID}>
            {s.listings.map((l, i) => <Reveal key={l.id} i={i}><ListingCard listing={l} /></Reveal>)}
          </div>
        </section>
      )}

      {s.resources.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl">Study resources</h2>
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {s.resources.map((r, i) => <Reveal key={r.id} i={i}><ResourceCard r={r} /></Reveal>)}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div className="min-w-[92px] rounded-card bg-bg px-4 py-3 text-center">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-[24px] font-bold leading-none">{value}</dd>
      <dd className="mt-1 text-[12px] text-ink-faint">{label}</dd>
    </div>
  )
}
