import { formatPrice } from '../lib/format.js'

const SIZES = {
  sm: { price: 'text-[15px]', extra: 'text-[12px]' },
  md: { price: 'text-[17px]', extra: 'text-[12.5px]' },
  lg: { price: 'text-[32px]', extra: 'text-[16px]' },
}

// Selling price, with the MRP slashed and the % off beside it when the seller gave one
// (like ₹900 ~~₹1,500~~ 40% off). Without an MRP it's just the price.
export default function PriceTag({ price, mrp, size = 'md', className = '' }) {
  const s = SIZES[size]
  const discounted = mrp > price && price > 0
  const off = discounted ? Math.round(((mrp - price) / mrp) * 100) : 0
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`font-display font-bold ${s.price}`}>{formatPrice(price)}</span>
      {discounted && (
        <>
          <s className={`text-ink-faint ${s.extra}`} aria-label={`MRP ${formatPrice(mrp)}`}>{formatPrice(mrp)}</s>
          {off > 0 && <span className={`font-semibold text-leaf ${s.extra}`}>{off}% off</span>}
        </>
      )}
    </p>
  )
}
