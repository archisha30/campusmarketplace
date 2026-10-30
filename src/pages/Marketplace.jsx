import { useRef, useState } from 'react'
import { listingsApi } from '../services/api.js'
import { useApi, useDebounced } from '../hooks/useApi.js'
import { CATEGORIES, CONDITIONS } from '../data/sample.js'
import ListingCard from '../components/ListingCard.jsx'
import { SkeletonGrid } from '../components/SkeletonCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PostRequestBanner from '../components/PostRequestBanner.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { ChipRow, Select } from '../components/FilterBar.jsx'
import RecommendationBar from '../components/RecommendationBar.jsx'
import Pagination from '../components/Pagination.jsx'
import { usePage } from '../hooks/usePage.js'

const PAGE_SIZE = 24 // 6 rows of 4

const PRICE_BANDS = [
  { value: 'any', label: 'Any price', min: undefined, max: undefined },
  { value: 'under500', label: 'Under ₹500', min: undefined, max: 499 },
  { value: 'mid', label: '₹500 – ₹1500', min: 500, max: 1500 },
  { value: 'over1500', label: 'Over ₹1500', min: 1501, max: undefined },
]

export default function Marketplace() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [condition, setCondition] = useState('any')
  const [listingType, setListingType] = useState('any')
  const [band, setBand] = useState('any')
  // 'auto' = Best match while searching, Newest otherwise.
  const [sort, setSort] = useState('auto')

  const debouncedQ = useDebounced(q)
  const price = PRICE_BANDS.find((b) => b.value === band)
  const searching = debouncedQ.trim() !== ''
  const apiSort = sort === 'auto' ? (searching ? 'relevance' : 'newest') : sort
  // Any new search/filter/sort starts again from page 1.
  const [page, setPage] = usePage([debouncedQ, category, condition, listingType, band, sort].join('|'))
  const listTop = useRef(null)

  function goToPage(p) {
    setPage(p)
    listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const { data, loading, error } = useApi(
    () =>
      listingsApi.list({
        q: debouncedQ,
        category,
        condition,
        listing_type: listingType,
        min_price: price.min,
        max_price: price.max,
        sort: apiSort,
        page,
        page_size: PAGE_SIZE,
      }),
    [debouncedQ, category, condition, listingType, band, apiSort, page]
  )

  const items = data?.items || []
  const hasFilters = Boolean(debouncedQ) || category !== 'All' || condition !== 'any' || listingType !== 'any' || band !== 'any'

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <div className="mb-7">
        <h1 className="text-[30px] font-bold">Marketplace</h1>
        <p className="mt-1.5 text-ink-soft">Find useful stuff from students around you.</p>
      </div>

      <RecommendationBar />

      <div ref={listTop} className="mb-5 flex scroll-mt-24 items-baseline justify-between gap-4">
        <h2 className="text-[22px] font-bold">All listings</h2>
        {!loading && !error && (
          <span className="text-[13px] text-ink-faint">{data?.total ?? items.length} {(data?.total ?? items.length) === 1 ? 'item' : 'items'}</span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <SearchBar value={q} onChange={setQ} placeholder="Search shoes, calculators, lab kits…" />
        <Select
          label="Sort listings"
          value={!searching && sort === 'newest' ? 'auto' : sort}
          onChange={setSort}
          options={[
            ...(searching
              ? [{ value: 'auto', label: 'Best match' }, { value: 'newest', label: 'Newest' }]
              : [{ value: 'auto', label: 'Newest' }]),
            { value: 'price_low', label: 'Price: Low → High' },
            { value: 'price_high', label: 'Price: High → Low' },
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
            body="Try another keyword, or clear some filters to see more listings."
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

      {!loading && !error && data?.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onChange={goToPage} noun="listings" />
      )}

      <PostRequestBanner className="mt-12" />
    </div>
  )
}
