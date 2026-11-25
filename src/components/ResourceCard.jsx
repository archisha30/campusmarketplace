import { Link } from 'react-router-dom'
import HeartButton from './HeartButton.jsx'
import { FreeTag } from './PriceTag.jsx'
import { formatPrice } from '../lib/format.js'
import { deliveryLabel, yearLabel } from '../lib/resources.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { useWishlist } from '../hooks/useWishlist.jsx'

export default function ResourceCard({ r }) {
  const { user } = useAuth()
  const { isResourceSaved, toggleResource } = useWishlist()
  const toast = useToast()
  const saved = isResourceSaved(r.id)
  const own = String(r.owner?.id) === String(user?.id)
  const meta = [
    r.subject,
    yearLabel(r.year),
    r.page_count ? `${r.page_count} page${r.page_count === 1 ? '' : 's'}` : null,
    r.copy_type === 'soft' ? deliveryLabel(r) : null,
    `by ${r.owner.name}`,
  ].filter(Boolean).join(' · ')

  return (
    <Link to={`/resources/${r.id}`} className="flex min-w-0 flex-col gap-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-tile">
        <PageSheet src={r.thumbnail_url} />
        <span className="absolute bottom-4 left-4 flex gap-2">
          <span className="rounded-control bg-paper px-3 py-1 text-[13px] font-semibold">{r.copy_type === 'hard' ? 'Hard copy' : 'Soft copy'}</span>
          {r.status === 'closed' && <span className="rounded-control bg-ink px-3 py-1 text-[13px] font-semibold text-white">Closed</span>}
        </span>
        {!own && (
          <HeartButton
            saved={saved}
            onToggle={() => toast(toggleResource(r) ? 'Saved to your wishlist' : 'Removed from your wishlist')}
          />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="line-clamp-2 min-w-0 font-sans text-[17px] font-semibold leading-snug tracking-normal">{r.title}</h3>
          <span className="hd flex-none text-xl">{r.offer_type === 'free' ? <FreeTag /> : formatPrice(r.price)}</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{meta}</p>
      </div>
    </Link>
  )
}

// The first page peeking out of the tile, or a drawn blank page when there's no preview.
function PageSheet({ src }) {
  const line = (w, className) => <div className={`h-1.5 rounded ${className}`} style={{ width: w }} />
  return (
    <div className="absolute inset-x-[16%] -bottom-6 top-6 overflow-hidden rounded-lg bg-paper" aria-hidden>
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="p-6">
          {line('60%', 'bg-line-strong')}
          {line('90%', 'mt-5 bg-line-soft')}
          {line('74%', 'mt-2 bg-line-soft')}
          {line('84%', 'mt-2 bg-line-soft')}
          <div style={{ filter: 'blur(3px)' }}>
            {line('86%', 'mt-4 bg-line-strong')}
            {line('66%', 'mt-2 bg-line-strong')}
            {line('78%', 'mt-2 bg-line-strong')}
          </div>
        </div>
      )}
    </div>
  )
}
