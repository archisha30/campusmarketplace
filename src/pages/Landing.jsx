import { Link } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { formatPrice } from '../lib/format.js'
import { VerifiedBadge } from '../components/Badge.jsx'

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

const TILT = ['-rotate-3 top-0 left-8', 'rotate-3 top-16 right-0 z-10', 'rotate-2 bottom-10 left-0', '-rotate-3 bottom-0 right-5']

export default function Landing() {
  const { data, loading } = useApi(() => listingsApi.list({ sort: 'newest' }), [])
  const preview = (data?.items || []).slice(0, 4)

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
              <Link to="/marketplace" className="btn-accent">Explore Marketplace</Link>
              <Link to="/sell" className="btn-ghost">Sell an Item</Link>
            </div>
          </div>

          <div className="relative mx-auto h-[340px] w-full max-w-[420px] md:h-[430px] md:max-w-none">
            {loading
              ? TILT.map((t, i) => <div key={i} className={`skeleton absolute w-[200px] h-[190px] ${t}`} />)
              : preview.map((l, i) => (
                  <Link
                    key={l.id}
                    to={`/listing/${l.id}`}
                    className={`absolute w-[200px] rounded-card border border-line bg-paper p-3.5 shadow-lift transition hover:z-20 hover:scale-[1.03] ${TILT[i]}`}
                  >
                    <div className="mb-2.5 flex h-24 items-center justify-center rounded-[10px] text-[34px]" style={{ background: l.art.bg }}>
                      {l.art.emoji}
                    </div>
                    <p className="text-[13.5px] font-semibold">{l.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">{l.condition} · {l.seller.campus}</p>
                    <p className="mt-1.5 font-display text-[15px] font-bold">{formatPrice(l.price)}</p>
                    <span className="mt-1.5 inline-block"><VerifiedBadge /></span>
                  </Link>
                ))}
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

      <section className="mx-auto max-w-[1180px] px-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-slab bg-[#141721] p-9">
          <div>
            <h3 className="mb-1.5 text-[20px] font-semibold text-white">Looking for something?</h3>
            <p className="text-sm text-[#B7BAC4]">"Need a Casio fx-991CW for tomorrow." Post a request — coming soon.</p>
          </div>
          <button disabled className="btn cursor-not-allowed bg-[#2A2E3A] text-ink-faint">
            Post a Request · Coming Soon
          </button>
        </div>
      </section>
    </>
  )
}
