import { RENT_PERIODS } from '../data/sample.js'
import { formatPrice } from '../lib/format.js'

const SIZES = {
  sm: { price: 'text-[17px]', extra: 'text-[12.5px]' },
  md: { price: 'text-xl leading-7 sm:text-2xl sm:leading-8', extra: 'text-[13px] leading-none' },
  lg: { price: 'text-[34px] md:text-[40px]', extra: 'text-base' },
}

// Sale: the price, with the MRP slashed and the % off beside it (₹900 ~~₹1,500~~ 40% off).
// Rent: the rent for the whole period (₹300 / month), the MRP as plain info (renting isn't a
// discount on buying), and the security deposit when one is asked and `deposit` is passed.
// Free items get the yellow "Free" tag.
export default function PriceTag({ price, mrp, listingType = 'sale', rentDays, deposit, size = 'md', className = '' }) {
  const s = SIZES[size]
  const rent = listingType === 'rent'
  const period = rent ? RENT_PERIODS.find((p) => p.days === Number(rentDays)) : null
  const discounted = !rent && mrp > price && price > 0
  const off = discounted ? Math.round(((mrp - price) / mrp) * 100) : 0
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`font-display font-semibold tracking-[-0.02em] ${s.price}`}>
        {Number(price) === 0 ? <FreeTag /> : formatPrice(price)}
        {period && <span className={`font-sans font-medium tracking-normal text-ink-soft ${s.extra}`}> / {period.short}</span>}
      </span>
      {discounted && (
        <>
          <s className={`text-ink-faint ${s.extra}`} aria-label={`MRP ${formatPrice(mrp)}`}>{formatPrice(mrp)}</s>
          {off > 0 && <span className={`font-semibold text-leaf ${s.extra}`}>{off}% off</span>}
        </>
      )}
      {rent && mrp > 0 && <span className={`text-ink-faint ${s.extra}`}>MRP {formatPrice(mrp)}</span>}
      {rent && deposit > 0 && <span className={`text-ink-soft ${s.extra}`}>+ {formatPrice(deposit)} deposit</span>}
    </p>
  )
}

export function FreeTag({ className = '' }) {
  return <span className={`rounded-control bg-sun px-2 ${className}`}>Free</span>
}
