import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { resourcesApi } from '../services/api.js'
import { useApi, useDebounced } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { Select } from '../components/FilterBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PostRequestBanner from '../components/PostRequestBanner.jsx'
import { SUBJECTS, YEARS } from '../lib/resources.js'
import ResourceCard from '../components/ResourceCard.jsx'
import ResourcePicks from '../components/ResourcePicks.jsx'
import Pagination from '../components/Pagination.jsx'
import { usePage } from '../hooks/usePage.js'

const PAGE_SIZE = 18 // 6 rows of 3

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
]

export default function Resources() {
  const { isSeller } = useAuth()
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('All')
  const [year, setYear] = useState('any')
  const [copyType, setCopyType] = useState('any')
  const [offerType, setOfferType] = useState('any')
  const [sort, setSort] = useState('newest')
  const [mine, setMine] = useState(false)
  const debouncedQ = useDebounced(q)

  // Any new search/filter/sort starts again from page 1.
  const [page, setPage] = usePage([debouncedQ, subject, year, copyType, offerType, sort, mine].join('|'))
  const listTop = useRef(null)
  const { data: facets } = useApi(() => resourcesApi.facets(), [])
  const { data, loading, error } = useApi(
    () => resourcesApi.list({
      q: debouncedQ, subject, year, copy_type: copyType, offer_type: offerType, sort, mine: mine || undefined,
      page, page_size: PAGE_SIZE,
    }),
    [debouncedQ, subject, year, copyType, offerType, sort, mine, page]
  )

  function goToPage(p) {
    setPage(p)
    listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const items = data?.items || []
  const subjects = facets?.subjects || SUBJECTS
  const filtered = Boolean(debouncedQ) || subject !== 'All' || year !== 'any' || copyType !== 'any' || offerType !== 'any'

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold">Resource Hub</h1>
          <p className="mt-2.5 max-w-2xl text-[14.5px] text-ink-soft">
            Notes, question banks and printed copies from students on your campus. Preview the first page,
            then buy or grab the free ones. Payment is by UPI or cash, straight to the student.
          </p>
        </div>
        {isSeller && <Link to="/resources/new" className="btn-accent">+ Post a resource</Link>}
      </div>

      <div className="mt-6">{!mine && !filtered && <ResourcePicks />}</div>

      <div ref={listTop} className="mb-5 flex scroll-mt-24 flex-wrap gap-2.5">
        <SearchBar value={q} onChange={setQ} placeholder="Search titles, subjects, descriptions…" />
      </div>

      <div className="mb-7 flex flex-wrap items-center gap-2.5">
        <Select label="Subject" value={subject} onChange={setSubject}
          options={[{ value: 'All', label: 'All subjects' }, ...subjects.map((s) => ({ value: s, label: s }))]} />
        <Select label="Year" value={year} onChange={setYear}
          options={[{ value: 'any', label: 'All years' }, ...YEARS.filter((y) => y.value !== 'any')]} />
        <Select label="Copy type" value={copyType} onChange={setCopyType}
          options={[{ value: 'any', label: 'Soft & hard copies' }, { value: 'soft', label: 'Soft copy' }, { value: 'hard', label: 'Hard copy' }]} />
        <Select label="Offer type" value={offerType} onChange={setOfferType}
          options={[{ value: 'any', label: 'Paid & free' }, { value: 'sale', label: 'For sale' }, { value: 'free', label: 'Free' }]} />
        <Select label="Sort" value={sort} onChange={setSort} options={SORTS} />
        {isSeller && (
          <button
            type="button"
            aria-pressed={mine}
            onClick={() => setMine((m) => !m)}
            className={`rounded-pill border-[1.5px] px-4 py-2 text-[13.5px] font-semibold transition ${
              mine ? 'border-brand bg-brand text-white' : 'border-line bg-paper text-ink-soft hover:border-ink'
            }`}
          >
            Mine
          </button>
        )}
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[300px]" />)}
        </div>
      )}

      {!loading && error && (
        <EmptyState emoji="⚠️" title="Couldn't load resources" body={error.message} />
      )}

      {!loading && !error && items.length === 0 && (
        mine ? (
          <EmptyState emoji="📝" title="You haven't posted anything yet" body="Share notes, question banks or a printed copy." actionLabel="Post a resource" actionTo="/resources/new" />
        ) : (
          <EmptyState emoji="📚" title="No resources found" body={filtered ? 'Try another subject or clear a filter.' : 'Be the first to share study material.'} />
        )
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => <ResourceCard key={r.id} r={r} showStatus={mine} />)}
        </div>
      )}

      {!loading && !error && data?.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onChange={goToPage} noun="resources" />
      )}

      <PostRequestBanner className="mt-12" />
    </div>
  )
}
