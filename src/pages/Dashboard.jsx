import { useState } from 'react'
import { listingsApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { SkeletonRows } from '../components/SkeletonCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { formatPrice, titleCase } from '../lib/format.js'

const TABS = [
  { label: 'Active', status: 'available' },
  { label: 'Reserved', status: 'reserved' },
  { label: 'Sold', status: 'sold' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState(TABS[0])

  const { data, loading, refetch } = useApi(
    () => listingsApi.list({ seller_id: user?.id, status: tab.status, include_sold: true }),
    [user?.id, tab.status]
  )
  const items = data?.items || []

  async function changeStatus(id, status) {
    await listingsApi.setStatus(id, status)
    toast(`Marked ${status}`)
    refetch()
  }

  async function remove(id) {
    await listingsApi.remove(id)
    toast('Listing deleted')
    refetch()
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <h1 className="mb-6 text-[30px] font-bold">My Listings</h1>

      <div className="mb-6 flex border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t)}
            aria-current={tab.label === t.label}
            className={`-mb-px mr-6 border-b-[2.5px] pb-3 pt-3 text-[14.5px] font-semibold ${
              tab.label === t.label ? 'border-brand text-ink' : 'border-transparent text-ink-faint'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonRows />}

      {!loading && items.length === 0 && (
        <EmptyState
          emoji="📭"
          title="Nothing here yet"
          body="Be the first person to list something on your campus."
          actionLabel="Sell an Item"
          actionTo="/sell"
        />
      )}

      {!loading && items.map((l) => (
        <div key={l.id} className="mb-3 flex flex-wrap items-center gap-4 rounded-card border border-line bg-paper p-3.5">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[10px] text-[26px]" style={{ background: l.art.bg }}>
            {l.art.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">{l.title}</p>
            <p className="text-[13px] text-ink-soft">{formatPrice(l.price)} · {titleCase(l.status)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost btn-sm" onClick={() => toast('Editing lands in the next pass')}>Edit</button>
            {l.status === 'available' && (
              <button className="btn-ghost btn-sm" onClick={() => changeStatus(l.id, 'reserved')}>Mark Reserved</button>
            )}
            {l.status !== 'sold' && (
              <button className="btn-ghost btn-sm" onClick={() => changeStatus(l.id, 'sold')}>Mark Sold</button>
            )}
            <button className="btn-danger btn-sm" onClick={() => remove(l.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
