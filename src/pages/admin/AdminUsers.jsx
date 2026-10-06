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

export default function AdminUsers() {
  const { user: me, isOwner } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const { data, loading, error, setData } = useApi(() => adminApi.users(debouncedQ), [debouncedQ])
  const [busy, setBusy] = useState(null)
  const items = data?.items || []

  async function toggleAdmin(u) {
    const making = !u.is_admin
    if (!window.confirm(making ? `Make ${u.name || u.email} an admin? They'll see every user, listing and resource.` : `Remove admin access for ${u.name || u.email}?`)) return
    setBusy(u.id)
    try {
      const updated = await adminApi.setAdmin(u.id, making)
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === u.id ? updated : x)) }))
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
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Users" value={data.total} />
          <Stat label="Verified" value={items.filter((u) => u.verified).length} />
          <Stat label="Sellers" value={items.filter((u) => u.account_type === 'seller').length} />
          <Stat label="Admins" value={items.filter((u) => u.is_admin).length} />
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
        <Table head={['User', 'Type', 'Status', 'Listings', 'Resources', 'Joined', ...(isOwner ? ['Admin access'] : [])]}>
          {items.map((u) => (
            <tr key={u.id}>
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
                </div>
              </Td>
              <Td>{u.listings}</Td>
              <Td>{u.resources}</Td>
              <Td className="whitespace-nowrap text-ink-soft">{formatDate(u.created_at)}</Td>
              {isOwner && (
                <Td>
                  {u.is_owner ? (
                    <span className="text-[12.5px] text-ink-faint">Always</span>
                  ) : (
                    <button
                      className={u.is_admin ? 'btn-danger btn-sm' : 'btn-ghost btn-sm'}
                      disabled={busy === u.id || (!u.is_admin && !u.verified)}
                      title={!u.is_admin && !u.verified ? 'Only verified students can be admins' : undefined}
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
    </>
  )
}
