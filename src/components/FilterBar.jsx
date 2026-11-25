import { CATEGORIES } from '../data/sample.js'
import { categoryStyle } from '../lib/categories.js'

// Filter chips. An option is a plain string, or { value, label }. Categories get their dot.
export function ChipRow({ options, value, onChange, label, className = 'mb-6', children }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const v = o.value ?? o
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`chip ${value === v ? 'chip-on' : ''}`}
          >
            {CATEGORIES.includes(v) && <span className="dot" style={{ background: categoryStyle(v).dot }} />}
            {o.label ?? o}
          </button>
        )
      })}
      {children}
    </div>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <select
      aria-label={label}
      name={String(label).toLowerCase().replace(/\s+/g, '-')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="select h-[52px] min-w-0 max-w-full rounded-control border border-line-strong pl-4 text-base hover:border-ink focus:border-brand focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Toggle({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`chip ${value === o ? 'chip-on' : ''}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
