import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { SkeletonDetail } from '../components/SkeletonCard.jsx'
import { TypeBadge, VerifiedBadge } from '../components/Badge.jsx'
import ReportModal from '../components/ReportModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import RecommendedForYou from '../components/RecommendedForYou.jsx'
import { recordView } from '../lib/recommendations.js'
import { formatPrice, contactLink, titleCase } from '../lib/format.js'

export default function ListingDetail() {
  const { id } = useParams()
  const [reporting, setReporting] = useState(false)
  const { data: l, loading, error } = useApi(() => listingsApi.get(id), [id])

  useEffect(() => {
    if (l) recordView(l)
  }, [l])

  if (loading) return <div className="mx-auto max-w-[1180px] px-6 py-9"><SkeletonDetail /></div>
  if (error || !l) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-9">
        <EmptyState emoji="🤷" title="Listing not found" body="It may have been sold or removed." actionLabel="Back to Marketplace" actionTo="/marketplace" />
      </div>
    )
  }

  const links = contactLink(l)

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <Link to="/marketplace" className="btn-ghost btn-sm mb-5">← Back to Marketplace</Link>

      <div className="grid gap-12 md:grid-cols-[.9fr_1.1fr]">
        <div>
          <div className="mb-3 flex h-[340px] items-center justify-center rounded-slab text-[90px]" style={{ background: l.art.bg }}>
            {l.art.emoji}
          </div>
          <div className="flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-[60px] w-[60px] items-center justify-center rounded-[10px] border-[1.5px] border-line text-2xl" style={{ background: l.art.bg }}>
                {l.art.emoji}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex gap-2">
            <TypeBadge type={l.listing_type} />
            <VerifiedBadge />
          </div>
          <h1 className="text-[28px] font-bold">{l.title}</h1>
          <p className="my-3 font-display text-[32px] font-bold">{formatPrice(l.price)}</p>

          <dl className="my-5 flex flex-wrap gap-5 border-y border-line py-4 text-[13.5px] text-ink-soft">
            <div><dt className="inline font-semibold text-ink">Condition: </dt><dd className="inline">{l.condition}</dd></div>
            <div><dt className="inline font-semibold text-ink">Category: </dt><dd className="inline">{l.category}</dd></div>
            <div><dt className="inline font-semibold text-ink">Listing type: </dt><dd className="inline">{titleCase(l.listing_type)}</dd></div>
          </dl>

          <p className="my-4 text-[15px] leading-relaxed text-ink-soft">{l.description}</p>

          <div className="my-5 flex items-center gap-3.5 rounded-card border border-line bg-paper p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sun font-display font-bold">
              {l.seller.name[0]}
            </span>
            <div>
              <p className="text-[14.5px] font-semibold">{l.seller.name}</p>
              <p className="text-[13px] text-ink-soft">{l.seller.campus}</p>
            </div>
            <span className="ml-auto"><VerifiedBadge /></span>
          </div>

          <p className="mb-5 text-[13.5px] text-ink-soft">
            <span className="font-semibold text-ink">Pickup spot:</span> {l.pickup_spot} ·{' '}
            <span className="font-semibold text-ink">Status:</span> {titleCase(l.status)}
          </p>

          <div className="flex flex-wrap gap-2.5">
            <a className="btn-accent" href={links.whatsapp} target="_blank" rel="noopener noreferrer">Contact Seller</a>
            <a className="btn-ghost" href={links.email}>Email instead</a>
            <button className="btn-ghost" onClick={() => setReporting(true)}>Report Listing</button>
          </div>

          <p className="mt-4 text-[12.5px] text-ink-faint">Meet on campus · Inspect before paying · Cash / UPI</p>
        </div>
      </div>

      <ReportModal open={reporting} onClose={() => setReporting(false)} targetTitle={l.title} listingId={l.id} />

      <div className="mt-10">
        <RecommendedForYou excludeId={l.id} title="More like this" />
      </div>
    </div>
  )
}
