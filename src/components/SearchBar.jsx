import Icon from './Icon.jsx'

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative min-w-[220px] flex-[1_1_320px]">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">
        <Icon name="search" />
      </span>
      <input
        type="search"
        name="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field-input pl-11"
      />
    </div>
  )
}
