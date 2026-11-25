import Icon from './Icon.jsx'

// ‹ Prev  1 … 4 5 6 … 12  Next ›   with "Showing 25–48 of 280".
function pageList(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1])
  const list = [...wanted].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b)
  const out = []
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

export default function Pagination({ page, pages, total, pageSize, onChange, noun = 'items' }) {
  if (!pages || pages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const btn = 'flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-control border px-3 text-sm font-semibold'

  return (
    <nav aria-label="Pages" className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          className={`${btn} border-line bg-paper text-ink hover:border-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line`}
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          <Icon name="chevron-left" size={18} />Prev
        </button>
        {pageList(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-ink-faint" aria-hidden>…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
              className={`${btn} ${p === page ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink hover:border-ink'}`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className={`${btn} border-line bg-paper text-ink hover:border-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line`}
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
        >
          Next<Icon name="chevron-right" size={18} />
        </button>
      </div>
      <p className="text-sm text-ink-soft">Showing {from}–{to} of {total} {noun}</p>
    </nav>
  )
}
