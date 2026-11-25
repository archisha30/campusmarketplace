import { CategoryArt } from '../CategoryTile.jsx'
import Icon from '../Icon.jsx'
import { formatPrice } from '../../lib/format.js'

// The phone beside the headline, showing real listings (`items` is null while they load).
// It's a picture: the same listings are links further down, so it's hidden from screen readers.
export default function PhoneHero({ items }) {
  const chips = ['All', ...new Set((items || []).map((l) => l.category))].slice(0, 3)
  return (
    <div aria-hidden className="relative flex h-[600px] min-w-0 flex-[1_1_440px] items-center justify-center">
      <div className="grow-in absolute h-[400px] w-[400px] flex-none rounded-full bg-brand" />

      <div className="phone relative h-[576px] w-[296px] flex-none rounded-[40px] bg-ink p-3">
        <div className="h-full w-full overflow-hidden rounded-[32px] bg-bg px-4 py-6">
          <p className="hd text-lg">Campus Market</p>
          <div className="mt-4 flex h-10 items-center gap-2 rounded-control border border-line bg-paper px-3 text-[13px] text-ink-soft">
            <Icon name="search" size={16} />Search listings…
          </div>
          <div className="mt-4 flex gap-2 overflow-hidden">
            {chips.map((c, i) => (
              <span
                key={c}
                className={`whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-semibold ${i === 0 ? 'border-ink bg-ink text-white' : 'border-line bg-paper'}`}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="feed mt-2">
            {items === null && [0, 1, 2, 3].map((i) => (
              <div key={i} className="border-b border-line-soft py-2"><div className="skeleton h-12 !rounded-control" /></div>
            ))}
            {items?.map((l) => (
              <div key={l.id} className="flex items-center gap-2 border-b border-line-soft py-2">
                <div className="h-12 w-12 flex-none">
                  <CategoryArt category={l.category} src={l.image} iconSize={24} className="rounded-control" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{l.title}</p>
                  <p className="mt-1 truncate text-xs text-ink-soft">{l.category}</p>
                </div>
                <p className="hd text-[15px]">{formatPrice(l.price)}</p>
              </div>
            ))}
            {items?.length === 0 && <p className="py-4 text-[13px] text-ink-soft">New listings show up here.</p>}
          </div>
        </div>
      </div>

      <div className="bubble-1 absolute left-0 top-24 hidden rounded-2xl rounded-bl bg-paper px-4 py-3 text-[15px] font-medium shadow-[0_8px_24px_-12px_rgba(10,14,60,.35)] md:block">
        Is this still available?
      </div>
      <div className="bubble-2 absolute bottom-[120px] right-0 hidden rounded-2xl rounded-br bg-sun px-4 py-3 text-[15px] font-semibold md:block">
        Yes! Meet on campus at 6?
      </div>
      <div className="sticker hd absolute bottom-8 left-[4%] hidden h-28 w-28 flex-col items-center justify-center rounded-full bg-sun text-[32px] leading-none md:flex">
        ₹0
        <span className="mt-1 font-sans text-xs font-bold tracking-normal">commission</span>
      </div>
    </div>
  )
}
