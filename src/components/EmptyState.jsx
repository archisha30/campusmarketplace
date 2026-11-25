import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

export default function EmptyState({ icon = 'inbox', title, body, actionLabel, actionTo }) {
  return (
    <div className="card px-6 py-16 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-control bg-bg text-ink">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="mb-2 text-xl">{title}</h3>
      <p className="mx-auto max-w-sm text-base leading-relaxed text-ink-soft">{body}</p>
      {actionLabel && actionTo && <Link to={actionTo} className="btn-primary mt-6">{actionLabel}</Link>}
    </div>
  )
}
