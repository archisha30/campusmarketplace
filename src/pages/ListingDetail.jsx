import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { SkeletonDetail } from '../components/SkeletonCard.jsx'
import { TypeBadge, VerifiedBadge } from '../components/Badge.jsx'
import ReportModal from '../components/ReportModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ImageLightbox from '../components/ImageLightbox.jsx'
import RecommendedForYou from '../components/RecommendedForYou.jsx'
import { recordListingView } from '../lib/recommendations.js'
import { formatPrice, contactLink, titleCase, foodTempLabel, formatDay, isExpired } from '../lib/format.js'
import Avatar from '../components/Avatar.jsx'
import LinkifiedText from '../components/LinkifiedText.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { recordContact } from '../hooks/useNotifications.js'
import { useWishlist } from '../hooks/useWishlist.jsx'
import { useToast } from '../hooks/useToast.jsx'

export default function ListingDetail() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { isSaved, toggle } = useWishlist()
  const toast = useToast()
  const [reporting, setReporting] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const { data: l, loading, error } = useApi(() => listingsApi.get(id), [id])

  useEffect(() => {
    // Wait for the session check so the view is saved to the right account.
    if (l && !authLoading) recordListingView(user, l)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l?.id, authLoading])

  if (loading) return <div className="mx-auto max-w-[1180px] px-6 py-9"><SkeletonDetail /></div>
  if (error || !l) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-9">
        <EmptyState emoji="🤷" title="Listing not found" body="It may have been sold or removed." actionLabel="Back to Marketplace" actionTo="/marketplace" />
      </div>
    )
  }

  const links = contactLink(l)
  const images = l.images && l.images.length > 0 ? l.images : []

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <Link to="/marketplace" className="btn-ghost btn-sm mb-5">← Back to Marketplace</Link>

      <div className="grid gap-12 md:grid-cols-[.9fr_1.1fr]">
        <div>
          {images.length > 0 ? (
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              aria-label="View full image"
              className="group relative mb-3 flex h-[340px] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-slab"
              style={{ background: l.art.bg }}
            >
              <img src={images[activeImage]} alt={l.title} className="h-full w-full object-cover" />
              <span className="absolute bottom-3 right-3 rounded-pill bg-black/60 px-3 py-1.5 text-[12px] font-semibold text-white opacity-90 transition group-hover:opacity-100">
                🔍 Click to enlarge
              </span>
            </button>
          ) : (
            <div className="mb-3 flex h-[340px] items-center justify-center overflow-hidden rounded-slab text-[90px]" style={{ background: l.art.bg }}>
              {l.art.emoji}
            </div>
          )}
          <div className="flex gap-2.5">
            {images.length > 0
              ? images.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setActiveImage(i)}
                    className={`h-[60px] w-[60px] overflow-hidden rounded-[10px] border-[1.5px] ${i === activeImage ? 'border-ink' : 'border-line'}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))
              : [0, 1, 2].map((i) => (
                  <div key={i} className="flex h-[60px] w-[60px] items-center justify-center rounded-[10px] border-[1.5px] border-line text-2xl" style={{ background: l.art.bg }}>
                    {l.art.emoji}
                  </div>
                ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TypeBadge type={l.listing_type} />
            {l.food_temp && (
              <span className={`badge ${l.food_temp === 'hot' ? 'bg-coral/12 text-coral' : 'bg-brand-tint text-brand'}`}>{foodTempLabel(l)}</span>
            )}
            {isExpired(l) && <span className="badge bg-line/60 text-ink-faint">Expired</span>}
            <VerifiedBadge />
            {String(l.seller?.id) !== String(user?.id) && (
              <button
                type="button"
                aria-pressed={isSaved(l.id)}
                onClick={() => toast(toggle(l) ? 'Saved to your wishlist' : 'Removed from your wishlist')}
                className={`ml-auto inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3 py-1 text-[12.5px] font-semibold transition ${
                  isSaved(l.id) ? 'border-coral bg-coral/10 text-coral' : 'border-line bg-paper text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                <span aria-hidden>{isSaved(l.id) ? '♥' : '♡'}</span>
                {isSaved(l.id) ? 'Saved' : 'Save to wishlist'}
              </button>
            )}
          </div>
          <h1 className="text-[28px] font-bold">{l.title}</h1>
          <p className="my-3 font-display text-[32px] font-bold">{formatPrice(l.price)}</p>

          <dl className="my-5 flex flex-wrap gap-5 border-y border-line py-4 text-[13.5px] text-ink-soft">
            {l.food_temp ? (
              <>
                <div><dt className="inline font-semibold text-ink">Served: </dt><dd className="inline">{foodTempLabel(l)}</dd></div>
                <div>
                  <dt className="inline font-semibold text-ink">Best before: </dt>
                  <dd className={`inline ${isExpired(l) ? 'text-coral' : ''}`}>
                    {l.expiry_date ? `${formatDay(l.expiry_date)}${isExpired(l) ? ' (expired)' : ''}` : 'Not given'}
                  </dd>
                </div>
              </>
            ) : (
              <div><dt className="inline font-semibold text-ink">Condition: </dt><dd className="inline">{l.condition}</dd></div>
            )}
            <div><dt className="inline font-semibold text-ink">Category: </dt><dd className="inline">{l.category}</dd></div>
            <div><dt className="inline font-semibold text-ink">Listing type: </dt><dd className="inline">{titleCase(l.listing_type)}</dd></div>
          </dl>

          <p className="my-4 text-[15px] leading-relaxed text-ink-soft whitespace-pre-line"><LinkifiedText text={l.description} /></p>

          <div className="my-5 flex items-center gap-3.5 rounded-card border border-line bg-paper p-4">
            <Avatar user={l.seller} size={44} className="bg-sun font-display text-ink" />
            <div>
              <p className="text-[14.5px] font-semibold">{l.seller.name || 'Campus student'}</p>
              <p className="text-[13px] text-ink-soft">{l.seller.campus || ''}</p>
            </div>
            <span className="ml-auto"><VerifiedBadge /></span>
          </div>

          <p className="mb-5 text-[13.5px] text-ink-soft">
            <span className="font-semibold text-ink">Pickup spot:</span> {l.pickup_spot} ·{' '}
            <span className="font-semibold text-ink">Status:</span> {titleCase(l.status)}
          </p>

          <div className="flex flex-wrap gap-2.5">
            {links.whatsapp ? (
              <>
                <a className="btn-accent" href={links.whatsapp} target="_blank" rel="noopener noreferrer"
                  onClick={() => recordContact(user, 'listing', l.id, 'whatsapp')}>Contact Seller</a>
                <a className="btn-ghost" href={links.email} target="_blank" rel="noopener noreferrer"
                  onClick={() => recordContact(user, 'listing', l.id, 'email')}>Email instead</a>
              </>
            ) : (
              // Older accounts may not have a number yet; email still reaches them.
              <a className="btn-accent" href={links.email} target="_blank" rel="noopener noreferrer"
                onClick={() => recordContact(user, 'listing', l.id, 'email')}>Email Seller</a>
            )}
            {String(l.seller?.id) !== String(user?.id) && (
              <button className="btn-ghost" onClick={() => setReporting(true)}>Report Listing</button>
            )}
          </div>

          <p className="mt-4 text-[12.5px] text-ink-faint">Meet on campus · Inspect before paying · Cash / UPI</p>
        </div>
      </div>

      {viewerOpen && images.length > 0 && (
        <ImageLightbox
          images={images}
          index={activeImage}
          onIndexChange={setActiveImage}
          onClose={() => setViewerOpen(false)}
          alt={l.title}
        />
      )}

      <ReportModal open={reporting} onClose={() => setReporting(false)} targetTitle={l.title} listingId={l.id} />

      <div className="mt-10">
        <RecommendedForYou excludeId={l.id} title="More like this" />
      </div>
    </div>
  )
}