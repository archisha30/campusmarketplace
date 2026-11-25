import Icon from './Icon.jsx'
import { categoryStyle } from '../lib/categories.js'

// "● Electronics"
export function CategoryLabel({ category, className = '' }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 text-sm text-ink-soft ${className}`}>
      <span className="dot" style={{ background: categoryStyle(category).dot }} />
      <span className="truncate">{category}</span>
    </span>
  )
}

// A listing's photo, or its category's colour and icon when there isn't one. Fills its parent.
export function CategoryArt({ category, src, alt = '', iconSize = 48, className = '' }) {
  const s = categoryStyle(category)
  return (
    <div className={`flex h-full w-full items-center justify-center overflow-hidden ${className}`} style={{ background: s.tint }}>
      {src
        ? <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        : <Icon name={s.icon} size={iconSize} stroke={1.5} />}
    </div>
  )
}
