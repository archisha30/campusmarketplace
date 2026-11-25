import Icon from './Icon.jsx'

// Shows the server-rendered preview: page 1 sharp (or half-blurred for a one-page sale),
// then pages 2-4 stacked under an unlock overlay. The blurred images are blurred on the
// server; nothing here relies on CSS to hide content.
export default function ResourcePreview({ resource: r, overlayTitle, overlayBody, cta }) {
  const pages = r.preview_pages || []
  const first = pages[0]
  const rest = pages.slice(1)
  const morePages = Math.max(0, (r.page_count || 0) - 1)

  if (!first) {
    return (
      <div className="flex h-[340px] flex-col items-center justify-center rounded-slab border border-line bg-paper p-8 text-center">
        <Icon name={r.copy_type === 'hard' ? 'book-open' : 'file-text'} size={40} stroke={1.5} className="mb-4" />
        <p className="font-semibold">No preview available</p>
        <p className="mt-1 max-w-xs text-sm text-ink-soft">
          {r.copy_type === 'hard'
            ? `This is a printed copy${r.pickup_spot ? `, picked up at ${r.pickup_spot}` : ''}.`
            : 'The owner hasn’t added a preview.'}
        </p>
      </div>
    )
  }

  const title = overlayTitle ?? (morePages > 0
    ? `Unlock the full resource, ${morePages} more page${morePages === 1 ? '' : 's'}`
    : 'Unlock the full resource')

  return (
    <div>
      <figure className="relative overflow-hidden rounded-card border border-line bg-white">
        <img src={first.url} alt={`Page 1 of ${r.title}`} className="block w-full" />
        <figcaption className="absolute left-4 top-4 rounded-control bg-paper px-3 py-2 text-sm font-semibold shadow-[0_0_0_1px_#E4E2DA]">
          Page 1{r.page_count ? ` of ${r.page_count}` : ''}
        </figcaption>
        {first.kind === 'partial' && (
          <PreviewOverlay title={title} body={overlayBody} cta={cta} className="top-1/2" />
        )}
      </figure>

      {rest.length > 0 && (
        <div className="relative mt-4">
          <div className="space-y-3" aria-hidden>
            {rest.map((p, i) => (
              <img
                key={p.url}
                src={p.url}
                alt=""
                loading="lazy"
                draggable={false}
                className="block w-full select-none rounded-card border border-line bg-white"
                style={{ marginTop: i === 0 ? 0 : -120 }}
              />
            ))}
          </div>
          <PreviewOverlay title={title} body={overlayBody} cta={cta} className="inset-y-0" />
        </div>
      )}

      {rest.length === 0 && first.kind !== 'partial' && morePages > 0 && (
        <div className="mt-4 rounded-card border border-line bg-paper p-5 text-center">
          <p className="font-display text-[17px] font-bold">{title}</p>
          {overlayBody && <p className="mt-1 text-sm text-ink-soft">{overlayBody}</p>}
          {cta && <div className="mt-3 flex flex-wrap justify-center gap-2">{cta}</div>}
        </div>
      )}
    </div>
  )
}

function PreviewOverlay({ title, body, cta, className = '' }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-center bg-white/80 px-6 text-center ${className}`}>
      <Icon name="lock" size={24} className="mb-2" />
      <p className="font-display text-[19px] font-bold">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{body}</p>}
      {cta && <div className="mt-4 flex flex-wrap justify-center gap-2">{cta}</div>}
    </div>
  )
}
