import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PostRequestBanner from '../components/PostRequestBanner.jsx'
import PriceTag from '../components/PriceTag.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { listingsApi } from '../services/api.js'

const TRUST = [
  { icon: '🎓', title: 'Verified Students', body: 'Only students using approved institutional email domains can create accounts.' },
  { icon: '📦', title: 'Zero Shipping', body: 'Buy directly from someone nearby and pick it up on campus.' },
  { icon: '🧑‍🤝‍🧑', title: 'Real People, Real Campus', body: "See the seller's campus and verified status before you meet." },
  { icon: '⚡', title: 'Simple & Fast', body: 'Find what you need without digging through hundreds of WhatsApp messages.' },
]

const STEPS = [
  { kicker: 'Find', title: 'Search what you need', body: 'Textbooks, electronics, dorm essentials, lab equipment, and more.' },
  { kicker: 'Connect', title: 'Message the seller', body: 'Contact the verified student directly through WhatsApp or email.' },
  { kicker: 'Meet & Exchange', title: 'Trade on campus', body: 'Meet at a safe campus location, inspect the item, and pay via cash or UPI.' },
]

// The landing page is only for visitors who aren't logged in (verified students go straight to the
// marketplace). It shows the listings the most students opened, as teaser cards without seller
// details; these category tiles fill in while the marketplace has fewer than four items.
const GUEST_TILES = [
  { emoji: '📘', title: 'Textbooks', bg: '#F1EAFF' },
  { emoji: '🔌', title: 'Electronics', bg: '#EAFBF0' },
  { emoji: '📐', title: 'Lab Gear', bg: '#EAF0FF' },
  { emoji: '🛏️', title: 'Dorm Essentials', bg: '#FFECEA' },
]

export default function Landing() {
  const { user, isVerified, loading: authLoading } = useAuth()
  const [popular, setPopular] = useState(null) // null while loading

  useEffect(() => {
    listingsApi.popular().then(setPopular).catch(() => setPopular([]))
  }, [])

  // Logged-in students only use the Marketplace and Resource Hub; the landing page is for visitors.
  if (!authLoading && isVerified) return <Navigate to="/marketplace" replace />

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-6 pb-10 pt-9 md:pt-16">
        <div className="grid items-center gap-12 md:grid-cols-[1.05fr_.95fr]">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-pill border border-line bg-paper py-1.5 pl-2 pr-3.5 text-[13px] font-medium text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-leaf" /> Verified students only
            </span>
            <h1 className="text-[40px] font-bold leading-[1.02] md:text-[56px]">
              Your campus.<br />Your marketplace.
            </h1>
            <p className="my-6 max-w-[480px] text-[17.5px] text-ink-soft">
              Buy, sell, rent, and share everything you need for college — from textbooks and lab kits
              to dorm essentials — with verified students around you.
            </p>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link to="/marketplace" className="btn-accent">Explore Marketplace</Link>
                  <Link to="/sell" className="btn-ghost">Sell an Item</Link>
                  <Link to="/resources/new" className="btn-ghost">Sell Resources</Link>
                </>
              ) : (
                <>
                  <Link to="/signup" className="btn-accent">Sign up to explore</Link>
                  <Link to="/login" className="btn-ghost">Log in</Link>
                </>
              )}
            </div>
          </div>

          {/* A 2x2 grid of cards inside the glowing box; the inner panel leaves 2px for the border. */}
          <div className="glow-box relative mx-auto w-full max-w-[560px] p-[2px]">
            <div className="grid grid-cols-2 gap-3 rounded-[24px] bg-gradient-to-br from-brand-tint via-paper to-[#FFF6E0] p-3 md:gap-4 md:p-5">
              {authLoading || popular === null
                ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[190px] md:h-[205px]" />)
                : [...popular, ...GUEST_TILES.slice(popular.length)].slice(0, 4).map((t) =>
                    t.id ? <PopularCard key={t.id} listing={t} /> : <CategoryTile key={t.title} tile={t} />
                  )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper py-16">
        <div className="mx-auto max-w-[1180px] px-6">
          <h2 className="mb-10 max-w-xl text-[28px] font-bold md:text-[34px]">
            Built for your campus, not the entire internet.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div key={t.title} className="rounded-card border border-line bg-bg/40 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-bg text-[19px]" aria-hidden>{t.icon}</div>
                <h3 className="mb-2 text-[16.5px] font-semibold">{t.title}</h3>
                <p className="text-sm text-ink-soft">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-[1180px] px-6 py-16">
        <h2 className="mb-2 text-[28px] font-bold md:text-[34px]">How it works</h2>
        <p className="mb-10 text-ink-soft">Three steps from browsing to handshake.</p>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.kicker}>
              <div className="relative mb-3.5 h-0.5 bg-line">
                <span className="absolute -top-1 left-0 h-2.5 w-2.5 rounded-full bg-brand" />
              </div>
              <p className="mb-3 font-display text-[13px] font-semibold text-brand">{s.kicker}</p>
              <h3 className="mb-2 text-[19px] font-semibold">{s.title}</h3>
              <p className="text-[14.5px] text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <PostRequestBanner className="mx-auto max-w-[1180px] px-6 pb-16" />
    </>
  )
}

// Hovering lifts the card above the others.
const CARD = 'relative block min-w-0 rounded-card border border-line bg-paper p-3 shadow-lift transition duration-300 hover:z-10 hover:-translate-y-1.5 hover:scale-[1.04] hover:shadow-xl md:p-3.5'

// A real listing. Visitors sign up first, then land on it (Signup sends them back to `from`).
function PopularCard({ listing: l }) {
  return (
    <Link to="/signup" state={{ from: `/listing/${l.id}` }} className={CARD}>
      <div className="mb-2.5 flex h-24 items-center justify-center overflow-hidden rounded-[10px] text-[34px] md:h-28" style={{ background: l.art?.bg || '#EFEFEC' }}>
        {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <span aria-hidden>{l.art?.emoji || '📦'}</span>}
      </div>
      <p className="truncate text-[13.5px] font-semibold">{l.title}</p>
      <PriceTag price={l.price} mrp={l.mrp} listingType={l.listing_type} rentDays={l.rent_days} size="sm" className="mt-0.5" />
      <p className="mt-1.5 text-[12.5px] font-semibold text-brand">Sign up to see it →</p>
    </Link>
  )
}

function CategoryTile({ tile: t }) {
  return (
    <Link to="/signup" className={CARD}>
      <div className="mb-2.5 flex h-24 items-center justify-center rounded-[10px] text-[34px] md:h-28" style={{ background: t.bg }}>
        {t.emoji}
      </div>
      <p className="truncate text-[13.5px] font-semibold">{t.title}</p>
      <p className="mt-0.5 truncate text-[12px] text-ink-faint">From students on campus</p>
      <p className="mt-1.5 text-[12.5px] font-semibold text-brand">Sign up to browse →</p>
    </Link>
  )
}
