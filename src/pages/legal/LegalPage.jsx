import { Link } from 'react-router-dom'

// Shared layout for /privacy and /terms: readable width, simple headings.
export default function LegalPage({ title, updated, children }) {
  return (
    <div className="mx-auto max-w-[760px] px-6 py-10">
      <Link to="/" className="btn-ghost btn-sm mb-6">← Back</Link>
      <h1 className="text-[30px] font-bold">{title}</h1>
      <p className="mb-8 mt-1.5 text-[13px] text-ink-faint">Last updated {updated}</p>
      <div className="space-y-7 text-[15px] leading-relaxed text-ink-soft [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </div>
  )
}
