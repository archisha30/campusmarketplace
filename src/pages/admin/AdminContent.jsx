import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, resourcesApi } from '../../services/api.js'
import { useApi, useDebounced } from '../../hooks/useApi.js'
import { useToast } from '../../hooks/useToast.jsx'
import SearchBar from '../../components/SearchBar.jsx'
import { SkeletonRows } from '../../components/SkeletonCard.jsx'
import { formatPrice, titleCase } from '../../lib/format.js'
import { deliveryLabel, yearLabel } from '../../lib/resources.js'
import { Stat, Table, Td, formatDate } from './AdminLayout.jsx'

const VIEWS = ['Listings', 'Resources']

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
  const [view, setView] = useState('Listings')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const listings = useApi(() => adminApi.listings(debouncedQ), [debouncedQ])
  const resources = useApi(() => adminApi.resources(debouncedQ), [debouncedQ])
  const current = view === 'Listings' ? listings : resources
  const items = current.data?.items || []

  async function remove(kind, item) {
    if (!window.confirm(`Delete the ${kind} "${item.title}"? This can't be undone, and its files are removed too.`)) return
    try {
      if (kind === 'listing') await adminApi.deleteListing(item.id)
      else await resourcesApi.remove(item.id)
      toast(`${titleCase(kind)} deleted`)
      current.refetch()
    } catch (err) {
      toast(err.message)
    }
  }

  return (
    <>
      {!debouncedQ && listings.data && resources.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Listings" value={listings.data.total} />
          <Stat label="Available listings" value={listings.data.items.filter((l) => l.status === 'available').length} />
          <Stat label="Resources" value={resources.data.total} />
          <Stat label="Open resources" value={resources.data.items.filter((r) => r.status === 'available').length} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-pill border-[1.5px] border-line bg-paper p-1">
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
      </div>

      {current.loading && <SkeletonRows />}
      {current.error && <p className="text-[14px] text-coral">{current.error.message}</p>}

      {!current.loading && !current.error && view === 'Listings' && (
        <Table head={['Listing', 'Seller', 'Price', 'Status', 'Posted', '']}>
          {items.map((l) => (
            <tr key={l.id}>
              <Td>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[9px] text-[20px]" style={{ background: l.art?.bg }}>
                    {l.images?.length ? <img src={l.images[0]} alt="" className="h-full w-full object-cover" /> : l.art?.emoji}
                  </div>
                  <div className="min-w-0">
                    <Link to={`/listing/${l.id}`} className="font-semibold hover:underline">{l.title}</Link>
                    <p className="text-[12.5px] text-ink-soft">{l.category} · {l.condition} · {titleCase(l.listing_type)}</p>
                  </div>
                </div>
              </Td>
              <Td><Owner person={l.seller} /></Td>
              <Td className="whitespace-nowrap">{formatPrice(l.price)}</Td>
              <Td><StatusBadge status={l.status} /></Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatDate(l.created_at)}</Td>
              <Td><button className="btn-danger btn-sm" onClick={() => remove('listing', l)}>Delete</button></Td>
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
                  <div className="h-11 w-11 flex-none overflow-hidden rounded-[9px] border border-line bg-bg">
                    {r.thumbnail_url && <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover object-top" />}
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
              <Td><StatusBadge status={r.status} /></Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatDate(r.created_at)}</Td>
              <Td><button className="btn-danger btn-sm" onClick={() => remove('resource', r)}>Delete</button></Td>
            </tr>
          ))}
          {items.length === 0 && <tr><Td className="text-ink-soft">No resources{debouncedQ ? ` match “${debouncedQ}”` : ' yet'}.</Td></tr>}
        </Table>
      )}
    </>
  )
}
