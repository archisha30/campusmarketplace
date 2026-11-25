import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.jsx'
import { HeartProp } from '../components/HeartButton.jsx'
import { ListingCardView } from '../components/ListingCard.jsx'
import MarketplacePopup from '../components/MarketplacePopup.jsx'
import PostRequestBanner from '../components/PostRequestBanner.jsx'
import Reveal from '../components/Reveal.jsx'
import { SkeletonListing } from '../components/SkeletonCard.jsx'
import PhoneHero from '../components/landing/PhoneHero.jsx'
import ResourceHubPanel from '../components/landing/ResourceHubPanel.jsx'
import { CATEGORIES } from '../data/sample.js'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { categoryStyle } from '../lib/categories.js'
import { listingsApi } from '../services/api.js'

// "40+" isn't counted by the app: update it here as more students join.
const STATS = [
  { big: '40+', label: 'Verified students' },
  { big: '0%', label: 'Commission, ever' },
  { big: '1 tap', label: 'To chat on WhatsApp' },
  { big: 'Free & paid', label: 'Notes in Resource Hub' },
]

const WHY = [
  { title: 'Students only', body: 'Everyone signs up with an educational email domain, so you know who’s on the other side.' },
  { title: 'Meet on campus', body: 'No shipping, no waiting. Pick up from the hostel lobby or after class.' },
  { title: 'Chat on WhatsApp', body: 'One tap to message the seller. No new inbox to check.' },
  { title: 'Keep every rupee', body: 'Zero commission. Sell it, or give it away free, your call.' },
]

const STEPS = [
  { kicker: 'Find', title: 'Search what you need', body: 'Textbooks, electronics, dorm essentials, lab equipment, and more.' },
  { kicker: 'Connect', title: 'Message the seller', body: 'Contact the verified student directly through WhatsApp or email.' },
  { kicker: 'Meet & Exchange', title: 'Trade on campus', body: 'Meet at a safe campus location, inspect the item, and pay via cash or UPI.' },
]

const SHOWN = 4 // listings in the "Just listed!" row
const LISTING_GRID = 'mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4'

// The home page, for everyone. Logged-in students see the same page without the log-in / sign-up
// options, plus a popup into the marketplace. Visitors see the listings the most students opened,
// as teaser cards without seller details; logged-in students see the newest in the marketplace.
export default function Landing() {
  const { user, isSeller, loading: authLoading, probablyMember } = useAuth()
  const [popular, setPopular] = useState(null) // null while loading

  useEffect(() => {
    listingsApi.popular().then(setPopular).catch(() => setPopular([]))
  }, [])

  const listings = authLoading ? null : popular
  const member = Boolean(user) || probablyMember
  // Visitors sign up first, then land on the page they wanted (Signup sends them back to `from`).
  const into = (path) => (member ? { to: path } : { to: '/signup', state: { from: path } })

  return (
    <div className="overflow-x-clip">
      <section className="wrap flex flex-wrap items-center gap-12 pb-12 pt-10 md:pt-16">
        <div className="min-w-0 flex-[1_1_320px] md:flex-[1_1_480px]">
          <h1 className="rise d1 text-[44px] leading-[1.02] md:text-[60px] xl:text-[72px]">
            Buy, sell and swap with your <span className="pop inline-block rounded-control bg-sun px-3">campus</span>.
          </h1>
          <p className="rise d2 mt-6 max-w-[480px] text-[19px] leading-relaxed text-ink-soft">
            List something in a minute, find what you need from batchmates, and chat on WhatsApp to meet on campus. No commission.
          </p>
          {/* Keeps its height while the session is checked, so students never see sign-up buttons flash by. */}
          <div className="rise d3 mt-8 flex min-h-[52px] flex-wrap gap-4">
            {probablyMember ? null : user ? (
              <>
                <Link to="/marketplace" className="btn-primary">Start browsing</Link>
                {isSeller && (
                  <>
                    <Link to="/sell" className="btn-secondary">Sell an item</Link>
                    <Link to="/resources/new" className="btn-secondary">Sell resources</Link>
                  </>
                )}
              </>
            ) : (
              <>
                <Link to="/#browse" className="btn-primary">Start browsing</Link>
                <Link to="/signup" className="btn-secondary">Sell an item</Link>
              </>
            )}
          </div>
        </div>
        <PhoneHero />
      </section>

      <section className="bg-sun">
        <div className="wrap grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} i={i} className="panel lift bg-paper p-6">
              <p className="hd text-[32px] leading-tight">{s.big}</p>
              <p className="mt-1 text-[15px] text-ink-soft">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="wrap pt-section">
        <p className="eyebrow">Why Campus Market</p>
        <Reveal as="h2" className="section-title mt-4 max-w-[720px]">Safer than OLX. Faster than the hostel WhatsApp group.</Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w, i) => (
            <Reveal key={w.title} i={i} className="card lift p-8">
              <span className="hd flex h-12 w-12 items-center justify-center rounded-control bg-sun text-xl">{i + 1}</span>
              <h3 className="mb-2 mt-6 text-[22px] leading-tight">{w.title}</h3>
              <p className="leading-relaxed text-ink-soft">{w.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="wrap scroll-mt-4 pt-section">
        <p className="eyebrow">How it works</p>
        <Reveal as="h2" className="section-title mt-4 max-w-[720px]">Three steps from browsing to handshake.</Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.kicker} i={i} className="card lift p-8">
              <p className="hd text-sm tracking-normal text-brand">{s.kicker}</p>
              <h3 className="mb-2 mt-4 text-[22px] leading-tight">{s.title}</h3>
              <p className="leading-relaxed text-ink-soft">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <JustListed teasers={listings} into={into} />
      <ResourceHubPanel link={into('/resources')} />
      <PostRequestBanner className="wrap pt-section" />
      <MarketplacePopup />
    </div>
  )
}

// `teasers` are the public listings (null while loading). Only verified students may load the rest
// of the marketplace, so for them the chips cover every category; for visitors, the ones shown.
function JustListed({ teasers, into }) {
  const { isVerified, needsPassword } = useAuth()
  const canBrowse = isVerified && !needsPassword
  const [category, setCategory] = useState('All')
  const market = useApi(
    () => (canBrowse
      ? listingsApi.list({ category, status: 'available', sort: 'newest', page: 1, page_size: SHOWN })
      : Promise.resolve(null)),
    [canBrowse, category]
  )

  // If the marketplace didn't load, the public listings still show.
  const fromMarket = canBrowse && !market.error
  const listings = fromMarket ? (market.loading || !market.data ? null : market.data.items) : teasers
  const categories = fromMarket ? CATEGORIES : [...new Set((teasers || []).map((l) => l.category))]
  const shown = (listings || []).filter((l) => category === 'All' || l.category === category)

  return (
    <section id="browse" className="wrap scroll-mt-4 pt-section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Fresh on campus</p>
          <Reveal as="h2" className="section-title mt-4">Just listed!</Reveal>
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {['All', ...categories].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={`chip ${category === c ? 'chip-on' : ''}`}
              >
                {c !== 'All' && <span className="dot" style={{ background: categoryStyle(c).dot }} />}
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {listings === null ? (
        <div className={LISTING_GRID}>{[0, 1, 2, 3].map((i) => <SkeletonListing key={i} />)}</div>
      ) : shown.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={category === 'All' ? 'Nothing listed right now' : `Nothing in ${category} right now`}
            body="New listings from students on campus show up here."
          />
        </div>
      ) : (
        <div className={LISTING_GRID}>
          {shown.map((l, i) => (
            <Reveal key={l.id} i={i}>
              <ListingCardView listing={l} photo={l.image || l.thumbnail || l.images?.[0]} heart={<HeartProp />} {...into(`/listing/${l.id}`)} />
            </Reveal>
          ))}
        </div>
      )}

      <div className="mt-8"><Link {...into('/marketplace')} className="btn-secondary">See all listings</Link></div>
    </section>
  )
}
