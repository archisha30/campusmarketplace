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
      <div className="flex h-[340px] flex-col items-center justify-center rounded-slab border border-dashed border-line bg-paper p-8 text-center">
        <div className="mb-3 text-[44px]" aria-hidden>{r.copy_type === 'hard' ? '📗' : '📄'}</div>
        <p className="font-semibold">No preview available</p>
        <p className="mt-1 max-w-xs text-[13.5px] text-ink-soft">
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
      <figure className="relative overflow-hidden rounded-card border border-line bg-white shadow-lift">
        <img src={first.url} alt={`Page 1 of ${r.title}`} className="block w-full" />
        <figcaption className="absolute left-3 top-3 rounded-pill bg-ink/75 px-2.5 py-1 text-[11.5px] font-semibold text-white">
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
          {overlayBody && <p className="mt-1 text-[13.5px] text-ink-soft">{overlayBody}</p>}
          {cta && <div className="mt-3 flex flex-wrap justify-center gap-2">{cta}</div>}
        </div>
      )}
    </div>
  )
}

function PreviewOverlay({ title, body, cta, className = '' }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/30 via-white/80 to-white px-6 text-center ${className}`}>
      <div className="mb-2 text-[26px]" aria-hidden>🔒</div>
      <p className="font-display text-[19px] font-bold">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[13.5px] text-ink-soft">{body}</p>}
      {cta && <div className="mt-4 flex flex-wrap justify-center gap-2">{cta}</div>}
    </div>
  )
}
