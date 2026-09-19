import { Link } from 'react-router-dom'

export default function EmptyState({ emoji = '📭', title, body, actionLabel, actionTo }) {
  return (
    <div className="rounded-slab border-[1.5px] border-dashed border-line bg-paper px-5 py-16 text-center">
      <div className="mb-3.5 text-[38px]" aria-hidden>{emoji}</div>
      <h3 className="mb-2 text-[19px] font-semibold">{title}</h3>
      <p className="mx-auto mb-5 max-w-sm text-[14.5px] text-ink-soft">{body}</p>
      {actionLabel && actionTo && <Link to={actionTo} className="btn-accent">{actionLabel}</Link>}
    </div>
  )
}
