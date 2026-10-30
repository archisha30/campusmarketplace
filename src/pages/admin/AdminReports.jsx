import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../services/api.js'
import { useApi } from '../../hooks/useApi.js'
import { useToast } from '../../hooks/useToast.jsx'
import { SkeletonRows } from '../../components/SkeletonCard.jsx'
import { titleCase } from '../../lib/format.js'
import { Stat, Table, Td, formatDate } from './AdminLayout.jsx'
import Pagination from '../../components/Pagination.jsx'
import { usePage } from '../../hooks/usePage.js'
import RemoveItemModal from '../../components/RemoveItemModal.jsx'
import { useReportSummary } from '../../hooks/useReportSummary.jsx'

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: '', label: 'All' },
]

// Every report, with who reported it (sellers only ever see "A student").
export default function AdminReports() {
  const toast = useToast()
  const { refresh: refreshSummary } = useReportSummary()
  const [status, setStatus] = useState('open')
  const [page, setPage] = usePage(status) // switching Open/Resolved/All starts from page 1
  const { data, loading, error, refetch } = useApi(() => adminApi.reports(status || undefined, page), [status, page])

  function goToPage(p) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const items = data?.items || []
  const [removing, setRemoving] = useState(null) // report whose item waits for a removal reason

  async function setReport(r, next) {
    try {
      await adminApi.setReportStatus(r.id, next)
      // Clearing the last open report on an item tells the seller it was reviewed and stays up.
      toast(next === 'resolved' ? (r.reports_on_item > 1 ? 'Marked resolved' : 'Resolved. The seller is told it stays up') : 'Reopened')
      refetch()
      refreshSummary()
    } catch (err) {
      toast(err.message)
    }
  }

  // Removing resolves every open report on the item and sends the seller the reason.
  async function removeItem(reason) {
    const r = removing
    await (r.target_type === 'listing' ? adminApi.removeListing(r.target_id, reason) : adminApi.removeResource(r.target_id, reason))
    toast(`${titleCase(r.target_type)} removed. The seller has been told why`)
    setRemoving(null)
    refetch()
    refreshSummary()
  }

  return (
    <>
      {data && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Open reports" value={data.open} />
        </div>
      )}

      <div className="mb-4 flex rounded-pill border-[1.5px] border-line bg-paper p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatus(f.value)}
            aria-pressed={status === f.value}
            className={`rounded-pill px-4 py-2 text-[13.5px] font-semibold transition ${status === f.value ? 'bg-ink text-white' : 'text-ink-soft'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonRows />}
      {error && <p className="text-[14px] text-coral">{error.message}</p>}

      {!loading && !error && (
        <Table head={['Item', 'Reason', 'Reported by', 'Seller', 'Date', '']}>
          {items.map((r) => (
            <tr key={r.id}>
              <Td>
                {r.target_exists ? (
                  <Link to={r.target_type === 'listing' ? `/listing/${r.target_id}` : `/resources/${r.target_id}`} className="font-semibold hover:underline">
                    {r.target_title}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink-faint line-through">{r.target_title}</span>
                )}
                <p className="text-[12.5px] text-ink-soft">
                  {r.target_held && <span className="badge mr-1.5 bg-coral/12 text-coral">Held for review</span>}
                  {titleCase(r.target_type)}{!r.target_exists && ' · deleted'}
                  {r.reports_on_item > 1 && <span className="ml-1 font-semibold text-coral">· reported {r.reports_on_item}×</span>}
                </p>
              </Td>
              <Td>
                <span className="badge bg-coral/10 text-coral">{r.reason}</span>
                {r.details && <p className="mt-1.5 max-w-[260px] break-words text-[12.5px] text-ink-soft">“{r.details}”</p>}
              </Td>
              <Td>
                <p className="font-medium">{r.reporter.name}</p>
                <p className="break-all text-[12.5px] text-ink-soft">{r.reporter.email}</p>
              </Td>
              <Td>
                <p className="font-medium">{r.owner.name}</p>
                <p className="break-all text-[12.5px] text-ink-soft">{r.owner.email}</p>
              </Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatDate(r.created_at)}</Td>
              <Td>
                <div className="flex flex-col gap-1.5">
                  {r.status === 'open' ? (
                    <>
                      <button className="btn-ghost btn-sm" onClick={() => setReport(r, 'resolved')} title="No rules broken: the item stays up">Mark resolved</button>
                      {r.target_exists && <button className="btn-danger btn-sm" onClick={() => setRemoving(r)}>Remove item</button>}
                    </>
                  ) : (
                    <button className="btn-ghost btn-sm" onClick={() => setReport(r, 'open')}>Reopen</button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><Td className="text-ink-soft">{status === 'open' ? 'No open reports. 🎉' : 'No reports here.'}</Td></tr>
          )}
        </Table>
      )}
      {!loading && !error && data?.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onChange={goToPage} noun="reports" />
      )}

      <RemoveItemModal
        item={removing && { kind: removing.target_type, title: removing.target_title }}
        onRemove={removeItem}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
