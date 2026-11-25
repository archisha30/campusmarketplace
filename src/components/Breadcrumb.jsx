import { Link } from 'react-router-dom'

// "Marketplace / Electronics / Title". Items without `to` are plain text.
export default function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex min-w-0 items-center gap-2 text-sm text-ink-soft">
      {items.map((it, i) => (
        <span key={i} className={`flex items-center gap-2 ${i === items.length - 1 ? 'min-w-0 text-ink' : 'flex-none'}`}>
          {i > 0 && <span aria-hidden className="text-ink-soft">/</span>}
          {it.to ? <Link to={it.to} className="hover:text-ink">{it.label}</Link> : <span className="truncate">{it.label}</span>}
        </span>
      ))}
    </nav>
  )
}
