// The card grid every listing page uses: two across on phones, four on wide screens.
export const CARD_GRID = 'grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4'

export function SkeletonListing() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-2">
        <div className="skeleton h-4 w-1/3 !rounded-lg" />
        <div className="skeleton h-6 w-1/2 !rounded-lg" />
        <div className="skeleton h-4 w-4/5 !rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 8, className = '' }) {
  return (
    <div className={`${CARD_GRID} ${className}`}>
      {Array.from({ length: count }).map((_, i) => <SkeletonListing key={i} />)}
    </div>
  )
}

export function SkeletonRows({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton h-[84px]" />)}
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div className="grid gap-12 md:grid-cols-[1.4fr_1fr]">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-4">
        <div className="skeleton h-8 w-2/3 !rounded-lg" />
        <div className="skeleton h-10 w-1/3 !rounded-lg" />
        <div className="skeleton h-24" />
        <div className="skeleton h-20" />
      </div>
    </div>
  )
}
