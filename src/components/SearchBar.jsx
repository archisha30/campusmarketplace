export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative min-w-[220px] flex-1">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-pill border-[1.5px] border-line bg-paper py-3 pl-11 pr-4 text-[14.5px] focus:border-brand focus:outline-none"
      />
    </div>
  )
}
