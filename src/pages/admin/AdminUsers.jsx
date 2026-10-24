import { useState } from 'react'
import { adminApi } from '../../services/api.js'
import { useApi, useDebounced } from '../../hooks/useApi.js'
import { useAuth } from '../../hooks/useAuth.jsx'
import { useToast } from '../../hooks/useToast.jsx'
import SearchBar from '../../components/SearchBar.jsx'
import Avatar from '../../components/Avatar.jsx'
import { SkeletonRows } from '../../components/SkeletonCard.jsx'
import { formatPhone } from '../../lib/format.js'
import { Stat, Table, Td, formatDate } from './AdminLayout.jsx'
import Pagination from '../../components/Pagination.jsx'
import Modal from '../../components/Modal.jsx'
import { usePage } from '../../hooks/usePage.js'

const REASONS = ['Scam or fake listing', 'Harassment or abusive messages', 'Selling prohibited items', 'Spam', 'Impersonation']

export default function AdminUsers() {
  const { user: me, isOwner } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const [page, setPage] = usePage(debouncedQ) // a new search starts from page 1
  const { data, loading, error, setData } = useApi(() => adminApi.users(debouncedQ, page), [debouncedQ, page])

  function goToPage(p) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const [busy, setBusy] = useState(null)
  const [suspending, setSuspending] = useState(null) // user waiting for a reason + confirm
  const [reason, setReason] = useState('')
  const items = data?.items || []

  const replace = (updated) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) }))

  // Owners can't be suspended, nobody suspends themselves, and only the owner can suspend an admin.
  const canSuspend = (u) => !u.is_owner && String(u.id) !== String(me?.id) && (!u.is_admin || isOwner)

  async function suspend() {
    setBusy(suspending.id)
    try {
      const updated = await adminApi.suspend(suspending.id, reason.trim())
      replace(updated)
      setData((d) => ({ ...d, suspended: (d.suspended || 0) + 1 }))
      toast(`${suspending.name || suspending.email} is suspended`)
      setSuspending(null)
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function reinstate(u) {
    if (!window.confirm(`Reinstate ${u.name || u.email}? They can log in again and their listings and resources come back.`)) return
    setBusy(u.id)
    try {
      replace(await adminApi.reinstate(u.id))
      setData((d) => ({ ...d, suspended: Math.max(0, (d.suspended || 1) - 1) }))
      toast('Account reinstated')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function toggleAdmin(u) {
    const making = !u.is_admin
    if (!window.confirm(making ? `Make ${u.name || u.email} an admin? They'll see every user, listing and resource.` : `Remove admin access for ${u.name || u.email}?`)) return
    setBusy(u.id)
    try {
      replace(await adminApi.setAdmin(u.id, making))
      toast(making ? 'Admin access given' : 'Admin access removed')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {!loading && data && !debouncedQ && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Users" value={data.total} />
          <Stat label="Verified" value={data.verified} />
          <Stat label="Sellers" value={data.sellers} />
          <Stat label="Admins" value={data.admins} />
          <Stat label="Suspended" value={data.suspended ?? 0} />
        </div>
      )}

      <div className="mb-4 flex">
        <SearchBar value={q} onChange={setQ} placeholder="Search by name or email…" />
      </div>

      {!isOwner && (
        <p className="mb-4 text-[13px] text-ink-faint">Only the owner can give or remove admin access.</p>
      )}

      {loading && <SkeletonRows />}
      {error && <p className="text-[14px] text-coral">{error.message}</p>}

      {!loading && !error && (
        <Table head={['User', 'Type', 'Status', 'Listings', 'Resources', 'Joined', 'Account', ...(isOwner ? ['Admin access'] : [])]}>
          {items.map((u) => (
            <tr key={u.id} className={u.suspended ? 'bg-coral/5' : undefined}>
              <Td>
                <div className="flex items-start gap-2.5">
                  <Avatar user={u} size={32} className="flex-none bg-sun font-display text-ink" />
                  <div className="min-w-0">
                    <p className="font-semibold">{u.name || '—'}{String(u.id) === String(me?.id) && <span className="ml-1.5 text-[12px] font-normal text-ink-faint">(you)</span>}</p>
                    <p className="break-all text-[12.5px] text-ink-soft">{u.email}</p>
                    <p className="text-[12px] text-ink-faint">
                      {[u.college, u.course, u.year, u.phone && formatPhone(u.phone)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </Td>
              <Td className="capitalize">{u.account_type}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {u.is_owner && <span className="badge bg-ink text-white">Owner</span>}
                  {u.is_admin && !u.is_owner && <span className="badge bg-brand-tint text-brand">Admin</span>}
                  {u.verified
                    ? <span className="badge bg-leaf/10 text-leaf">Verified</span>
                    : <span className="badge bg-sun/25 text-[#946B00]">Unverified</span>}
                  {!u.profile_completed && <span className="badge bg-bg text-ink-soft">No profile</span>}
                  {u.suspended && <span className="badge bg-coral text-white">Suspended</span>}
                </div>
                {u.suspended && u.suspension_reason && (
                  <p className="mt-1 max-w-[220px] text-[12px] text-coral">
                    {u.suspension_reason}{u.suspended_at ? ` · ${formatDate(u.suspended_at)}` : ''}
                  </p>
                )}
              </Td>
              <Td>{u.listings}</Td>
              <Td>{u.resources}</Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatDate(u.created_at)}</Td>
              <Td>
                {u.suspended ? (
                  <button className="btn-ghost btn-sm" disabled={busy === u.id} onClick={() => reinstate(u)}>Reinstate</button>
                ) : canSuspend(u) ? (
                  <button className="btn-danger btn-sm" disabled={busy === u.id} onClick={() => { setReason(''); setSuspending(u) }}>Suspend</button>
                ) : (
                  <span className="text-[12.5px] text-ink-faint">{u.is_owner ? 'Owner' : String(u.id) === String(me?.id) ? 'You' : 'Owner only'}</span>
                )}
              </Td>
              {isOwner && (
                <Td>
                  {u.is_owner ? (
                    <span className="text-[12.5px] text-ink-faint">Always</span>
                  ) : (
                    <button
                      className={u.is_admin ? 'btn-danger btn-sm' : 'btn-ghost btn-sm'}
                      disabled={busy === u.id || (!u.is_admin && (!u.verified || u.suspended))}
                      title={!u.is_admin && u.suspended ? 'Suspended accounts can’t be admins' : !u.is_admin && !u.verified ? 'Only verified students can be admins' : undefined}
                      onClick={() => toggleAdmin(u)}
                    >
                      {u.is_admin ? 'Remove admin' : 'Make admin'}
                    </button>
                  )}
                </Td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr><Td className="text-ink-soft">No users match “{debouncedQ}”.</Td></tr>
          )}
        </Table>
      )}
      {!loading && !error && data?.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} onChange={goToPage} noun="users" />
      )}

      <Modal open={Boolean(suspending)} onClose={() => busy !== suspending?.id && setSuspending(null)} title="Suspend this account?">
        {suspending && (
          <>
            <p className="text-[14px] text-ink-soft">
              <strong className="text-ink">{suspending.name || suspending.email}</strong> will be logged out everywhere, their listings,
              resources and requests disappear, and <strong className="break-words text-ink">{suspending.email}</strong> can never sign up or log in again.
            </p>
            <label className="field-label mt-4" htmlFor="suspend-reason">Reason (other admins see this)</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={`rounded-pill border px-2.5 py-1 text-[12px] ${reason === r ? 'border-brand bg-brand-tint text-brand' : 'border-line text-ink-soft'}`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea id="suspend-reason" rows={2} maxLength={300} className="field-input resize-y" value={reason}
              onChange={(e) => setReason(e.target.value)} placeholder="Which rule did they break?" />
            <p className="mt-1.5 text-[12px] text-ink-faint">You can reinstate the account later if this was a mistake.</p>
            <div className="mt-5 flex gap-2.5">
              <button className="btn-ghost flex-1" onClick={() => setSuspending(null)} disabled={busy === suspending.id} autoFocus>Cancel</button>
              <button className="btn-danger flex-1" onClick={suspend} disabled={busy === suspending.id || reason.trim().length < 3}>
                {busy === suspending.id ? 'Suspending…' : 'Suspend'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
