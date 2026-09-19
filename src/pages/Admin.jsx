import { useState } from 'react'
import { adminApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { useToast } from '../hooks/useToast.jsx'
import { SkeletonRows } from '../components/SkeletonCard.jsx'
import { titleCase } from '../lib/format.js'

const TABS = ['Reports', 'Users', 'Campus Domains']

export default function Admin() {
  const [tab, setTab] = useState('Reports')

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <h1 className="mb-5 text-[28px] font-bold">Admin Dashboard</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t}
            className={`rounded-pill border-[1.5px] px-4 py-2.5 text-[13.5px] font-semibold ${
              tab === t ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink-soft'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Reports' && <ReportsTable />}
      {tab === 'Users' && <UsersTable />}
      {tab === 'Campus Domains' && <DomainsTable />}
    </div>
  )
}

function Table({ head, children }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-line bg-[#FAFAF7] px-3.5 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function ReportsTable() {
  const toast = useToast()
  const { data, loading, refetch } = useApi(() => adminApi.reports(), [])
  if (loading) return <SkeletonRows count={3} />

  async function act(id, action) {
    await adminApi.resolveReport(id, action)
    toast(`Report ${action === 'dismiss' ? 'dismissed' : action === 'hide' ? 'listing hidden' : 'listing deleted'}`)
    refetch()
  }

  if (!data?.length) {
    return <p className="rounded-card border border-line bg-paper p-8 text-center text-ink-soft">No open reports. The queue is clear.</p>
  }

  return (
    <Table head={['Listing', 'Reporter', 'Reason', 'Date', 'Status', 'Review']}>
      {data.map((r) => (
        <tr key={r.id}>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{r.listing_title}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{r.reporter}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{r.reason}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{r.created_at}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{titleCase(r.status)}</td>
          <td className="border-b border-line px-3.5 py-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost btn-sm" onClick={() => act(r.id, 'hide')}>Hide</button>
              <button className="btn-danger btn-sm" onClick={() => act(r.id, 'delete')}>Delete</button>
              <button className="btn-ghost btn-sm" onClick={() => act(r.id, 'dismiss')}>Dismiss</button>
            </div>
          </td>
        </tr>
      ))}
    </Table>
  )
}

function UsersTable() {
  const toast = useToast()
  const { data, loading, refetch } = useApi(() => adminApi.users(), [])
  if (loading) return <SkeletonRows count={3} />

  async function setStatus(id, status) {
    await adminApi.setUserStatus(id, status)
    toast(`User ${status}`)
    refetch()
  }

  return (
    <Table head={['Name', 'College', 'Email', 'Status', 'Role', 'Actions']}>
      {data.map((u) => (
        <tr key={u.id}>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{u.name}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{u.college}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{u.email}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{titleCase(u.status)}</td>
          <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{titleCase(u.role)}</td>
          <td className="border-b border-line px-3.5 py-3">
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setStatus(u.id, 'suspended')}>Suspend</button>
              <button className="btn-danger btn-sm" onClick={() => setStatus(u.id, 'banned')}>Ban</button>
            </div>
          </td>
        </tr>
      ))}
    </Table>
  )
}

function DomainsTable() {
  const toast = useToast()
  const { data, loading, refetch } = useApi(() => adminApi.domains(), [])
  const [draft, setDraft] = useState({ name: '', email_domain: '', location: '' })
  if (loading) return <SkeletonRows count={3} />

  async function add() {
    if (!draft.email_domain.trim()) return toast('Enter a domain first')
    await adminApi.addDomain(draft)
    setDraft({ name: '', email_domain: '', location: '' })
    toast('Domain added')
    refetch()
  }

  return (
    <>
      <Table head={['Domain', 'Campus', 'Status', 'Actions']}>
        {data.map((d) => (
          <tr key={d.id}>
            <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{d.email_domain}</td>
            <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{d.name}</td>
            <td className="border-b border-line px-3.5 py-3 text-[13.5px]">{d.is_active ? 'Enabled' : 'Disabled'}</td>
            <td className="border-b border-line px-3.5 py-3">
              <div className="flex gap-2">
                <button className="btn-ghost btn-sm" onClick={async () => { await adminApi.toggleDomain(d.id, !d.is_active); refetch() }}>
                  {d.is_active ? 'Disable' : 'Enable'}
                </button>
                <button className="btn-danger btn-sm" onClick={async () => { await adminApi.removeDomain(d.id); toast('Domain removed'); refetch() }}>
                  Remove
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <div className="mt-5 flex flex-wrap gap-2.5 rounded-card border border-line bg-paper p-4">
        <input className="field-input max-w-[200px]" placeholder="Campus name" value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <input className="field-input max-w-[200px]" placeholder="email domain" value={draft.email_domain}
          onChange={(e) => setDraft((d) => ({ ...d, email_domain: e.target.value }))} />
        <input className="field-input max-w-[160px]" placeholder="Location" value={draft.location}
          onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
        <button className="btn-accent" onClick={add}>Add domain</button>
      </div>
    </>
  )
}
