import { Link } from 'react-router-dom'
import { CategoryArt } from './CategoryTile.jsx'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import PriceTag from './PriceTag.jsx'
import { formatPrice } from '../lib/format.js'

// After posting a request: listings and resources already up that match it (null = closed).
export default function RequestMatches({ matches, onClose }) {
  if (!matches) return null
  return (
    <Modal open onClose={onClose} title="Already on CampusMarket">
      <p className="-mt-2 mb-6 text-[15px] leading-relaxed text-ink-soft">
        Your request is posted, and we'll tell you if more turn up. Meanwhile, these might be what you need:
      </p>
      <ul className="mb-5 max-h-[55vh] space-y-2 overflow-y-auto">
        {matches.listings.map((l) => (
          <MatchRow
            key={`l${l.id}`}
            to={`/listing/${l.id}`}
            onOpen={onClose}
            title={l.title}
            thumb={l.thumbnail || l.images?.[0]}
            category={l.category}
          >
            <PriceTag price={l.price} mrp={l.mrp} listingType={l.listing_type} rentDays={l.rent_days} size="sm" />
          </MatchRow>
        ))}
        {matches.resources.map((r) => (
          <MatchRow
            key={`r${r.id}`}
            to={`/resources/${r.id}`}
            onOpen={onClose}
            title={r.title}
            thumb={r.thumbnail_url}
          >
            <span className="block text-[12.5px] text-ink-faint">
              Resource Hub · {r.subject} · {r.offer_type === 'free' ? 'Free' : formatPrice(r.price)}
            </span>
          </MatchRow>
        ))}
      </ul>
      <button type="button" className="btn-ghost w-full" onClick={onClose}>Done</button>
    </Modal>
  )
}

function MatchRow({ to, onOpen, title, thumb, category, children }) {
  return (
    <li>
      <Link to={to} onClick={onOpen} className="no-lift flex items-center gap-3 rounded-control border border-line p-2 hover:border-ink">
        <span className="block h-12 w-12 flex-none overflow-hidden rounded-control bg-tile">
          {category
            ? <CategoryArt category={category} src={thumb} iconSize={24} />
            : thumb
              ? <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
              : <span className="flex h-full w-full items-center justify-center"><Icon name="file-text" size={22} /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{title}</span>
          {children}
        </span>
        <span className="text-[13px] font-semibold text-ink-soft">View</span>
      </Link>
    </li>
  )
}
