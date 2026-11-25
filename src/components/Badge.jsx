import Icon from './Icon.jsx'

const STYLES = {
  sale: 'bg-brand-tint text-brand',
  rent: 'bg-ink text-white',
  free: 'bg-sun text-ink',
  neutral: 'bg-bg text-ink-soft',
}

export function TypeBadge({ type }) {
  const label = { sale: 'Sale', rent: 'Rent', free: 'Free' }[type] || type
  return <span className={`badge ${STYLES[type] || STYLES.neutral}`}>{label}</span>
}

export function VerifiedBadge({ campus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-normal text-brand">
      <Icon name="shield-check" size={16} />
      Verified student{campus ? ` · ${campus}` : ''}
    </span>
  )
}

export function StatusPill({ status }) {
  if (!status) return null
  const tone = {
    available: 'bg-bg text-ink-soft',
    reserved: 'bg-sun text-ink',
    sold: 'bg-coral text-white',
  }[status]
  return <span className={`badge ${tone}`}>{status[0].toUpperCase() + status.slice(1)}</span>
}
