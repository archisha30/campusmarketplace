const STYLES = {
  sale: 'bg-brand-tint text-brand',
  rent: 'bg-sun/25 text-[#946B00]',
  free: 'bg-coral/12 text-coral',
  verified: 'bg-leaf/10 text-leaf',
  neutral: 'bg-bg text-ink-soft',
}

export function TypeBadge({ type }) {
  const label = { sale: 'Sale', rent: 'Rent', free: 'Free' }[type] || type
  return <span className={`badge ${STYLES[type] || STYLES.neutral}`}>{label}</span>
}

export function VerifiedBadge({ campus }) {
  return (
    <span className={`badge ${STYLES.verified}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 13 4 4L19 7" />
      </svg>
      Verified Student{campus ? ` · ${campus}` : ''}
    </span>
  )
}

export function StatusPill({ status }) {
  const tone = {
    available: 'bg-bg text-ink-soft',
    reserved: 'bg-sun/25 text-[#946B00]',
    sold: 'bg-line/60 text-ink-faint',
  }[status]
  return <span className={`badge ${tone}`}>{status[0].toUpperCase() + status.slice(1)}</span>
}
