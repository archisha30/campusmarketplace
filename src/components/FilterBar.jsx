export function ChipRow({ options, value, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`rounded-pill border-[1.5px] px-4 py-2 text-[13.5px] font-medium transition ${
            value === o ? 'border-brand bg-brand text-white' : 'border-line bg-paper text-ink-soft hover:border-ink'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[10px] border-[1.5px] border-line bg-paper px-3.5 py-2.5 text-[13.5px] focus:border-brand focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Toggle({ options, value, onChange }) {
  return (
    <div className="flex rounded-pill border-[1.5px] border-line bg-paper p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`rounded-pill px-4 py-2 text-[13.5px] font-semibold transition ${
            value === o ? 'bg-ink text-white' : 'text-ink-soft'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
