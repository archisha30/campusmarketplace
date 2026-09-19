import { useState } from 'react'
import { listingsApi } from '../services/api.js'
import { useApi, useDebounced } from '../hooks/useApi.js'
import { CATEGORIES, CONDITIONS } from '../data/sample.js'
import ListingCard from '../components/ListingCard.jsx'
import { SkeletonGrid } from '../components/SkeletonCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { ChipRow, Select, Toggle } from '../components/FilterBar.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import RecommendedForYou from '../components/RecommendedForYou.jsx'

const PRICE_BANDS = [
  { value: 'any', label: 'Any price', min: undefined, max: undefined },
  { value: 'under500', label: 'Under ₹500', min: undefined, max: 499 },
  { value: 'mid', label: '₹500 – ₹1500', min: 500, max: 1500 },
  { value: 'over1500', label: 'Over ₹1500', min: 1501, max: undefined },
]

export default function Marketplace() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [condition, setCondition] = useState('any')
  const [listingType, setListingType] = useState('any')
  const [band, setBand] = useState('any')
  const [sort, setSort] = useState('newest')
  const [scope, setScope] = useState('My Campus')

  const debouncedQ = useDebounced(q)
  const price = PRICE_BANDS.find((b) => b.value === band)

  const { data, loading, error } = useApi(
    () =>
      listingsApi.list({
        q: debouncedQ,
        category,
        condition,
        listing_type: listingType,
        min_price: price.min,
        max_price: price.max,
        sort,
        campus_id: scope === 'My Campus' ? user?.campus_id : undefined,
      }),
    [debouncedQ, category, condition, listingType, band, sort, scope, user?.campus_id]
  )

  const items = data?.items || []
  const hasFilters = Boolean(debouncedQ) || category !== 'All' || condition !== 'any' || listingType !== 'any' || band !== 'any'

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold">Marketplace</h1>
          <p className="mt-1.5 text-ink-soft">Find useful stuff from students around you.</p>
        </div>
        <Toggle options={['My Campus', 'Nearby Campuses']} value={scope} onChange={setScope} />
      </div>

      <RecommendedForYou />

      <div className="mb-5 flex flex-wrap gap-2.5">
        <SearchBar value={q} onChange={setQ} placeholder="Search textbooks, calculators, lab kits…" />
        <Select
          label="Sort listings"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'price_asc', label: 'Price: Low → High' },
            { value: 'price_desc', label: 'Price: High → Low' },
          ]}
        />
      </div>

      <ChipRow options={['All', ...CATEGORIES]} value={category} onChange={setCategory} />

      <div className="mb-7 flex flex-wrap gap-2.5">
        <Select label="Price" value={band} onChange={setBand} options={PRICE_BANDS.map((b) => ({ value: b.value, label: b.label }))} />
        <Select
          label="Condition"
          value={condition}
          onChange={setCondition}
          options={[{ value: 'any', label: 'Any condition' }, ...CONDITIONS.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          label="Listing type"
          value={listingType}
          onChange={setListingType}
          options={[
            { value: 'any', label: 'Any listing type' },
            { value: 'sale', label: 'Sale' },
            { value: 'rent', label: 'Rent' },
            { value: 'free', label: 'Free' },
          ]}
        />
      </div>

      {loading && <SkeletonGrid />}

      {error && !loading && (
        <EmptyState
          emoji="⚠️"
          title="Listings didn't load"
          body={error.message}
          actionLabel="Reload"
          actionTo="/marketplace"
        />
      )}

      {!loading && !error && items.length === 0 && (
        hasFilters ? (
          <EmptyState
            emoji="🔍"
            title="No items found"
            body="Try another keyword or expand your search to nearby campuses."
            actionLabel="Sell an Item"
            actionTo="/sell"
          />
        ) : (
          <EmptyState
            emoji="📭"
            title="Nothing here yet"
            body="Be the first person to list something on your campus."
            actionLabel="Sell an Item"
            actionTo="/sell"
          />
        )
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  )
}
