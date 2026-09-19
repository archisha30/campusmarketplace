export function SkeletonGrid({ count = 8, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-4 md:grid-cols-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-[236px]" />
      ))}
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
    <div className="grid gap-10 md:grid-cols-2">
      <div className="skeleton h-[340px] rounded-slab" />
      <div className="space-y-4">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-10 w-1/3" />
        <div className="skeleton h-24" />
        <div className="skeleton h-20" />
      </div>
    </div>
  )
}
