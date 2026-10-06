import { Link } from 'react-router-dom'
import { formatPrice } from '../lib/format.js'
import { deliveryLabel, yearLabel } from '../lib/resources.js'

export default function ResourceCard({ r, showStatus }) {
  return (
    <Link to={`/resources/${r.id}`} className="group block overflow-hidden rounded-card border border-line bg-paper transition hover:border-brand hover:shadow-lift">
      <div className="relative h-[170px] overflow-hidden border-b border-line bg-bg">
        {r.thumbnail_url ? (
          <img src={r.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center text-[46px]" aria-hidden>{r.copy_type === 'hard' ? '📗' : '📄'}</div>
        )}
        <span className={`badge absolute left-3 top-3 text-[12px] ${r.offer_type === 'free' ? 'bg-coral text-white' : 'bg-ink text-white'}`}>
          {r.offer_type === 'free' ? 'Free' : formatPrice(r.price)}
        </span>
        {showStatus && r.status === 'closed' && (
          <span className="badge absolute right-3 top-3 bg-paper text-ink-faint">Closed</span>
        )}
      </div>
      <div className="p-4">
        <p className="mb-1 font-display text-[12.5px] font-bold text-brand">{r.subject} · {yearLabel(r.year)}</p>
        <h3 className="mb-2.5 line-clamp-2 text-[15.5px] font-semibold">{r.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <span className="badge bg-bg text-ink-soft">{r.copy_type === 'hard' ? 'Hard copy' : 'Soft copy'}</span>
          {r.copy_type === 'soft' && <span className="badge bg-bg text-ink-soft">{deliveryLabel(r)}</span>}
          {r.page_count ? <span className="badge bg-bg text-ink-soft">{r.page_count} page{r.page_count === 1 ? '' : 's'}</span> : null}
        </div>
        <p className="mt-3 text-[12.5px] text-ink-faint">✓ {r.owner.name}</p>
      </div>
    </Link>
  )
}
