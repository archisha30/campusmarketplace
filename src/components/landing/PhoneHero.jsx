import Icon from '../Icon.jsx'

// Sample listings for the picture, not real ones (those are further down the page).
const CHIPS = ['All', 'Books', 'Free']
const SAMPLES = [
  { title: 'Geared city cycle', meta: 'Day scholar · 1d', price: '₹3,800', icon: 'bike', tint: '#DEF0CB' },
  { title: 'Grewal, Maths', meta: 'Hostel A · 2h', price: '₹250', icon: 'book-open', tint: '#FFE4CF' },
  { title: 'Headphones', meta: 'Hostel B · 5h', price: '₹2,400', icon: 'headphones', tint: '#D4EEF2' },
  { title: 'Electric kettle', meta: 'Hostel B · 2d', price: 'Free', icon: 'lamp', tint: '#E9DFFB' },
]

// The phone beside the headline: a picture of the app, hidden from screen readers.
export default function PhoneHero() {
  return (
    <div aria-hidden className="relative flex h-[600px] min-w-0 flex-[1_1_440px] items-center justify-center">
      <div className="grow-in absolute h-[400px] w-[400px] flex-none rounded-full bg-brand" />

      <div className="phone relative h-[576px] w-[296px] flex-none rounded-[40px] bg-ink p-3">
        <div className="h-full w-full overflow-hidden rounded-[32px] bg-bg px-4 py-6">
          <p className="hd text-lg">Campus Market</p>
          <div className="mt-4 flex h-10 items-center gap-2 rounded-control border border-line bg-paper px-3 text-[13px] text-ink-soft">
            <Icon name="search" size={16} />Search books, cycles…
          </div>
          <div className="mt-4 flex gap-2 overflow-hidden">
            {CHIPS.map((c, i) => (
              <span
                key={c}
                className={`whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-semibold ${i === 0 ? 'border-ink bg-ink text-white' : 'border-line bg-paper'}`}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="feed mt-2">
            {SAMPLES.map((l) => (
              <div key={l.title} className="flex items-center gap-2 border-b border-line-soft py-2">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-control" style={{ background: l.tint }}>
                  <Icon name={l.icon} size={24} stroke={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{l.title}</p>
                  <p className="mt-1 truncate text-xs text-ink-soft">{l.meta}</p>
                </div>
                <p className="hd text-[15px]">{l.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bubble-1 absolute left-0 top-24 hidden rounded-2xl rounded-bl bg-paper px-4 py-3 text-[15px] font-medium shadow-[0_8px_24px_-12px_rgba(10,14,60,.35)] md:block">
        Is the cycle still available?
      </div>
      <div className="bubble-2 absolute bottom-[120px] right-0 hidden rounded-2xl rounded-br bg-sun px-4 py-3 text-[15px] font-semibold md:block">
        Yes! Hostel B, 6 pm?
      </div>
      <div className="sticker hd absolute bottom-8 left-[4%] hidden h-28 w-28 flex-col items-center justify-center rounded-full bg-sun text-[32px] leading-none md:flex">
        ₹0
        <span className="mt-1 font-sans text-xs font-bold tracking-normal">commission</span>
      </div>
    </div>
  )
}
