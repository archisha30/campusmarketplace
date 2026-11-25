import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../services/api.js'
import { useApi, useDebounced } from '../../hooks/useApi.js'
import { useToast } from '../../hooks/useToast.jsx'
import SearchBar from '../../components/SearchBar.jsx'
import { SkeletonRows } from '../../components/SkeletonCard.jsx'
import { formatPrice, titleCase } from '../../lib/format.js'
import { deliveryLabel, yearLabel } from '../../lib/resources.js'
import { Stat, Table, Td, formatDate } from './AdminLayout.jsx'
import Pagination from '../../components/Pagination.jsx'
import { usePage } from '../../hooks/usePage.js'
import RemoveItemModal from '../../components/RemoveItemModal.jsx'
import { useReportSummary } from '../../hooks/useReportSummary.jsx'
import { CategoryArt } from '../../components/CategoryTile.jsx'

const VIEWS = ['Listings', 'Resources']

const LISTING_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'views', label: 'Most viewed' },
  { value: 'contacts', label: 'Most contacted' },
]

const STATUS_TONE = {
  available: 'bg-leaf/10 text-leaf',
  reserved: 'bg-sun/25 text-[#946B00]',
  sold: 'bg-line/60 text-ink-faint',
  closed: 'bg-line/60 text-ink-faint',
}

function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_TONE[status] || 'bg-bg text-ink-soft'}`}>{titleCase(status)}</span>
}

function Owner({ person }) {
  return (
    <>
      <p className="font-medium">{person?.name || '—'}</p>
      {person?.email && <p className="break-all text-[12.5px] text-ink-soft">{person.email}</p>}
    </>
  )
}

export default function AdminContent() {
  const toast = useToast()
  const { refresh: refreshSummary } = useReportSummary()
  const [view, setView] = useState('Listings')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('newest') // listings only
  const debouncedQ = useDebounced(q)
  // One page number for the tab you're on; switching tab, searching or sorting starts from page 1.
  const [page, setPage] = usePage(`${view}|${debouncedQ}|${sort}`)
  const listingsPage = view === 'Listings' ? page : 1
  const resourcesPage = view === 'Resources' ? page : 1
  const listings = useApi(() => adminApi.listings(debouncedQ, listingsPage, sort), [debouncedQ, listingsPage, sort])
  const resources = useApi(() => adminApi.resources(debouncedQ, resourcesPage), [debouncedQ, resourcesPage])
  const current = view === 'Listings' ? listings : resources

  function goToPage(p) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const items = current.data?.items || []
  const [removing, setRemoving] = useState(null) // { kind, id, title } waiting for a reason

  async function remove(reason) {
    const { kind, id } = removing
    await (kind === 'listing' ? adminApi.removeListing(id, reason) : adminApi.removeResource(id, reason))
    toast(`${titleCase(kind)} removed. The seller has been told why`)
    setRemoving(null)
    current.refetch()
    refreshSummary() // its open reports were resolved
  }

  return (
    <>
      {!debouncedQ && listings.data && resources.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Listings" value={listings.data.total} />
          <Stat label="Available listings" value={listings.data.available} />
          <Stat label="Resources" value={resources.data.total} />
          <Stat label="Open resources" value={resources.data.open} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-pill border border-line bg-paper p-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-pill px-4 py-2 text-[13.5px] font-semibold transition ${view === v ? 'bg-ink text-white' : 'text-ink-soft'}`}
            >
              {v}{(v === 'Listings' ? listings : resources).data ? ` (${(v === 'Listings' ? listings : resources).data.total})` : ''}
            </button>
          ))}
        </div>
        <SearchBar value={q} onChange={setQ} placeholder={view === 'Listings' ? 'Search listing titles…' : 'Search titles or subjects…'} />
        {view === 'Listings' && (
          <select
            aria-label="Sort listings"
            className="field-input w-auto py-2 text-[13.5px]"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {LISTING_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {current.loading && <SkeletonRows />}
      {current.error && <p className="text-[14px] text-coral">{current.error.message}</p>}

      {!current.loading && !current.error && view === 'Listings' && (
        <Table head={['Listing', 'Seller', 'Price', 'Status', 'Views', 'Contacts', 'Posted', '']}>
          {items.map((l) => (
            <tr key={l.id}>
              <Td>
                <div className="flex items-start gap-2.5">
                  <div className="h-11 w-11 flex-none overflow-hidden rounded-control">
                    <CategoryArt category={l.category} src={l.images?.length ? l.thumbnail || l.images[0] : null} iconSize={20} />
                  </div>
                  <div className="min-w-0">
                    <Link to={`/listing/${l.id}`} className="font-semibold hover:underline">{l.title}</Link>
                    <p className="text-[12.5px] text-ink-soft">{l.category} · {l.condition} · {titleCase(l.listing_type)}</p>
                  </div>
                </div>
              </Td>
              <Td><Owner person={l.seller} /></Td>
              <Td className="whitespace-nowrap">{formatPrice(l.price)}</Td>
              <Td><StatusBadge status={l.status} />{l.held && <span className="badge ml-1 bg-coral/12 text-coral">Held for review</span>}</Td>
              <Td className="whitespace-nowrap tabular-nums"><span title="Different students who opened it">{l.views ?? 0}</span></Td>
              <Td className="whitespace-nowrap tabular-nums"><span title="Different students who tapped Contact Seller">{l.contacts ?? 0}</span></Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatDate(l.created_at)}</Td>
              <Td><button className="btn-danger btn-sm" onClick={() => setRemoving({ kind: 'listing', id: l.id, title: l.title })}>Remove</button></Td>
            </tr>
          ))}
          {items.length === 0 && <tr><Td className="text-ink-soft">No listings{debouncedQ ? ` match “${debouncedQ}”` : ' yet'}.</Td></tr>}
        </Table>
      )}

      {!current.loading && !current.error && view === 'Resources' && (
        <Table head={['Resource', 'Owner', 'Price', 'Format', 'Status', 'Posted', '']}>
          {items.map((r) => (
            <tr key={r.id}>
              <Td>
                <div className="flex items-start gap-2.5">
                  <div className="h-11 w-11 flex-none overflow-hidden rounded-control border border-line bg-bg">
                    {r.thumbnail_url && <img src={r.thumbnail_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />}
                  </div>
                  <div className="min-w-0">
                    <Link to={`/resources/${r.id}`} className="font-semibold hover:underline">{r.title}</Link>
                    <p className="text-[12.5px] text-ink-soft">{r.subject} · {yearLabel(r.year)}{r.page_count ? ` · ${r.page_count} pages` : ''}</p>
                  </div>
                </div>
              </Td>
              <Td><Owner person={r.owner} /></Td>
              <Td className="whitespace-nowrap">{r.offer_type === 'free' ? 'Free' : formatPrice(r.price)}</Td>
              <Td className="whitespace-nowrap">{r.copy_type === 'hard' ? 'Hard copy' : `Soft · ${deliveryLabel(r)}`}</Td>
              <Td><StatusBadge status={r.status} />{r.held && <span className="badge ml-1 bg-coral/12 text-coral">Held for review</span>}</Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatDate(r.created_at)}</Td>
              <Td><button className="btn-danger btn-sm" onClick={() => setRemoving({ kind: 'resource', id: r.id, title: r.title })}>Remove</button></Td>
            </tr>
          ))}
          {items.length === 0 && <tr><Td className="text-ink-soft">No resources{debouncedQ ? ` match “${debouncedQ}”` : ' yet'}.</Td></tr>}
        </Table>
      )}

      {!current.loading && !current.error && current.data?.pages > 1 && (
        <Pagination
          page={current.data.page}
          pages={current.data.pages}
          total={current.data.total}
          pageSize={current.data.page_size}
          onChange={goToPage}
          noun={view === 'Listings' ? 'listings' : 'resources'}
        />
      )}

      <RemoveItemModal item={removing} onRemove={remove} onClose={() => setRemoving(null)} />
    </>
  )
}
