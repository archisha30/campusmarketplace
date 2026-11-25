import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { SkeletonDetail } from '../components/SkeletonCard.jsx'
import { TypeBadge, VerifiedBadge } from '../components/Badge.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import { CategoryArt, CategoryLabel } from '../components/CategoryTile.jsx'
import Icon from '../components/Icon.jsx'
import ReportModal from '../components/ReportModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ImageLightbox from '../components/ImageLightbox.jsx'
import RecommendedForYou from '../components/RecommendedForYou.jsx'
import { recordListingView } from '../lib/recommendations.js'
import PriceTag from '../components/PriceTag.jsx'
import ShareButton from '../components/ShareButton.jsx'
import { RENT_PERIODS } from '../data/sample.js'
import { formatPrice, listedOn, titleCase, foodTempLabel, formatDay, isExpired } from '../lib/format.js'
import { categoryStyle } from '../lib/categories.js'
import { openContact } from '../lib/contact.js'
import Avatar from '../components/Avatar.jsx'
import LinkifiedText from '../components/LinkifiedText.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useWishlist } from '../hooks/useWishlist.jsx'
import { useToast } from '../hooks/useToast.jsx'


const rentPeriodLabel = (days) => RENT_PERIODS.find((p) => p.days === Number(days))?.label

export default function ListingDetail() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { isSaved, toggle } = useWishlist()
  const toast = useToast()
  const [reporting, setReporting] = useState(false)
  const [contacting, setContacting] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const { data: l, loading, error } = useApi(() => listingsApi.get(id), [id])

  useEffect(() => {
    // Wait for the session check so the view is saved to the right account.
    if (l && !authLoading) recordListingView(user, l)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l?.id, authLoading])

  if (loading) return <div className="wrap py-9"><SkeletonDetail /></div>
  if (error || !l) {
    return (
      <div className="wrap py-9">
        <EmptyState icon="search-x" title="Listing not found" body="It may have been sold or removed." actionLabel="Back to Marketplace" actionTo="/marketplace" />
      </div>
    )
  }

  // The seller's number/email isn't in the page; it's fetched only when Contact is tapped.
  async function contact(channel) {
    setContacting(true)
    try {
      await openContact({
        targetType: 'listing',
        targetId: l.id,
        channel,
        subject: `CampusMarket — ${l.title}`,
        message: `Hi! I'm interested in your ${l.title} listed on CampusMarket. Is it still available?`,
      })
    } catch (err) {
      toast(err.message)
    } finally {
      setContacting(false)
    }
  }
  const images = l.images && l.images.length > 0 ? l.images : []
  const own = String(l.seller?.id) === String(user?.id)
  const tint = categoryStyle(l.category).tint

  return (
    <div className="wrap py-8">
      <Breadcrumb items={[{ label: 'Marketplace', to: '/marketplace' }, { label: l.category }, { label: l.title }]} />

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div className="min-w-0">
          {images.length > 0 ? (
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              aria-label="View full image"
              className="no-lift relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-card"
              style={{ background: tint }}
            >
              <img src={images[activeImage]} alt={l.title} className="h-full w-full object-cover" />
              <span className="absolute left-4 top-4 rounded-control bg-paper px-3 py-2 text-sm font-semibold">
                Photo {activeImage + 1} of {images.length}
              </span>
              <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-control bg-paper px-3 py-2 text-sm font-semibold">
                <Icon name="zoom-in" size={18} /><span className="hidden sm:inline">Click to enlarge</span>
              </span>
            </button>
          ) : (
            <div className="aspect-[4/3]"><CategoryArt category={l.category} iconSize={160} className="rounded-card" /></div>
          )}
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={i === activeImage}
                  onClick={() => setActiveImage(i)}
                  className={`aspect-[4/3] overflow-hidden rounded-control border-2 ${i === activeImage ? 'border-brand' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <CategoryLabel category={l.category} />
              <StatusLabel status={l.status} />
              <TypeBadge type={l.listing_type} />
              {l.food_temp && <span className="badge bg-brand-tint text-brand">{foodTempLabel(l)}</span>}
              {isExpired(l) && <span className="badge bg-line text-ink-soft">Expired</span>}
              <ShareButton
                className="ml-auto"
                title={l.title}
                path={`/listing/${l.id}`}
                message={`Check out "${l.title}" (${l.listing_type === 'free' ? 'free' : formatPrice(l.price)}${l.listing_type === 'rent' ? ` to rent for ${rentPeriodLabel(l.rent_days) || 'a while'}` : ''}) on CampusMarket`}
              />
            </div>
            <h1 className="mt-4 break-words text-[32px] leading-[1.1] lg:text-[40px]">{l.title}</h1>
            <PriceTag price={l.price} mrp={l.mrp} listingType={l.listing_type} rentDays={l.rent_days} size="lg" className="mt-4" />
            <p className="mt-2 text-[15px] text-ink-soft">
              {[l.food_temp ? null : l.condition, l.seller?.campus, l.created_at && listedOn(l.created_at)].filter(Boolean).join(' · ')}
            </p>
          </div>

          {l.held && (
            <p className="flex gap-3 rounded-control border border-coral/30 bg-coral/5 p-4 text-sm leading-relaxed text-coral">
              <Icon name="circle-pause" />
              <span>
                <strong>Held for review.</strong> Several students reported this listing, so it's hidden from everyone else until
                the CampusMarket team reviews it.
                {own
                  ? " You can still edit it; you'll get a notification with the outcome."
                  : <> Resolve or remove it from <Link to="/admin/reports" className="font-semibold underline">Admin → Reports</Link>.</>}
              </span>
            </p>
          )}

          <p className="whitespace-pre-line break-words text-[17px] leading-relaxed text-[#3B3B47]"><LinkifiedText text={l.description} /></p>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-4 text-[15px] text-ink-soft">
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
            <div><dt className="inline font-semibold text-ink">Listing type: </dt><dd className="inline">{titleCase(l.listing_type)}</dd></div>
            {l.listing_type === 'rent' && l.rent_days && (
              <div><dt className="inline font-semibold text-ink">Rented for: </dt><dd className="inline">{rentPeriodLabel(l.rent_days)}</dd></div>
            )}
            {l.listing_type === 'rent' && (
              <div>
                <dt className="inline font-semibold text-ink">Security deposit: </dt>
                <dd className="inline">{l.security_deposit ? `${formatPrice(l.security_deposit)} (refunded when you return it)` : 'None'}</dd>
              </div>
            )}
            <div><dt className="inline font-semibold text-ink">Pickup spot: </dt><dd className="inline">{l.pickup_spot}</dd></div>
          </dl>

          <div className="card flex items-center gap-4 p-6">
            <Avatar user={l.seller} size={56} className="bg-[#FFE4CF] font-display text-ink" />
            <div className="min-w-0 flex-1">
              <Link to={`/u/${l.seller.id}`} className="text-[17px] font-semibold hover:underline">{l.seller.name || 'Campus student'}</Link>
              <p className="mt-1"><VerifiedBadge /></p>
              <p className="mt-1 text-sm text-ink-soft">
                {l.seller.campus ? `${l.seller.campus} · ` : ''}
                <Link to={`/u/${l.seller.id}`} className="font-semibold text-brand hover:underline">See their items</Link>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {l.status === 'sold' ? (
              <p className="flex min-h-[52px] flex-[1_1_200px] items-center rounded-control bg-coral/10 px-4 font-semibold text-coral">This item has been sold.</p>
            ) : l.seller?.has_phone ? (
              <button className="btn-primary flex-[1_1_240px]" disabled={contacting} onClick={() => contact('whatsapp')}>
                <Icon name="message-circle" />Contact seller on WhatsApp
              </button>
            ) : (
              // Older accounts may not have a number yet; email still reaches them.
              <button className="btn-primary flex-[1_1_240px]" disabled={contacting} onClick={() => contact('email')}>
                <Icon name="mail" />Email seller
              </button>
            )}
            {!own && (
              <button
                type="button"
                aria-pressed={isSaved(l.id)}
                aria-label={isSaved(l.id) ? 'Saved to wishlist' : 'Save to wishlist'}
                onClick={() => toast(toggle(l) ? 'Saved to your wishlist' : 'Removed from your wishlist')}
                className="btn-secondary flex-[1_0_auto] sm:flex-none"
              >
                <Icon name="heart" filled={isSaved(l.id)} className={isSaved(l.id) ? 'text-coral' : ''} />
                {isSaved(l.id) ? 'Saved' : 'Save'}
              </button>
            )}
          </div>

          {((l.status !== 'sold' && l.seller?.has_phone) || !own) && (
            <div className="-mt-2 flex flex-wrap gap-4">
              {l.status !== 'sold' && l.seller?.has_phone && (
                <button className="btn-ghost btn-sm" disabled={contacting} onClick={() => contact('email')}><Icon name="mail" size={18} />Email instead</button>
              )}
              {!own && <button className="btn-ghost btn-sm" onClick={() => setReporting(true)}><Icon name="flag" size={18} />Report listing</button>}
            </div>
          )}

          <div className="flex gap-4 rounded-control bg-[#FFF8DC] p-4">
            <Icon name="map-pin" />
            <p className="text-sm leading-relaxed">
              Meet somewhere public on campus, like the library or a hostel lobby. Check the item works before you pay, by cash or UPI.
            </p>
          </div>
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

      <div className="mt-section">
        <RecommendedForYou excludeId={l.id} title="More like this" />
      </div>
    </div>
  )
}

// "● Available"
function StatusLabel({ status }) {
  const tone = { available: ['#16A34A', 'text-leaf'], reserved: ['#CA8A04', 'text-[#854D0E]'], sold: ['#B42318', 'text-coral'] }[status]
  if (!tone) return null
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${tone[1]}`}>
      <span className="dot" style={{ background: tone[0] }} />{titleCase(status)}
    </span>
  )
}
