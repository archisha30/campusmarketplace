import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { resourcesApi } from '../services/api.js'
import { useApi } from '../hooks/useApi.js'
import { VerifiedBadge } from '../components/Badge.jsx'
import ReportModal from '../components/ReportModal.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function ResourceDetail() {
  const { id } = useParams()
  const [reporting, setReporting] = useState(false)
  const { data: r, loading, error, setData } = useApi(() => resourcesApi.get(id), [id])

  if (loading) return <div className="mx-auto max-w-[760px] px-6 py-9"><div className="skeleton h-96" /></div>
  if (error || !r) {
    return (
      <div className="mx-auto max-w-[760px] px-6 py-9">
        <EmptyState emoji="📚" title="Resource not found" body="It may have been removed by the contributor." actionLabel="Back to Resource Hub" actionTo="/resources" />
      </div>
    )
  }

  async function helpful() {
    setData(await resourcesApi.markHelpful(r.id))
  }

  return (
    <div className="mx-auto max-w-[760px] px-6 py-9">
      <Link to="/resources" className="btn-ghost btn-sm mb-5">← Back to Resource Hub</Link>

      <p className="font-display text-[15px] font-bold text-brand">{r.course_code} · {r.department}</p>
      <h1 className="my-2.5 text-[26px] font-bold">{r.title}</h1>

      <dl className="my-5 flex flex-wrap gap-5 border-y border-line py-4 text-[13.5px] text-ink-soft">
        <div><dt className="inline font-semibold text-ink">Semester: </dt><dd className="inline">{r.semester}</dd></div>
        <div><dt className="inline font-semibold text-ink">Category: </dt><dd className="inline">{r.category}</dd></div>
        <div className="flex items-center gap-2">
          <dt className="font-semibold text-ink">Contributor:</dt>
          <dd className="flex items-center gap-2">{r.contributor.name} <VerifiedBadge /></dd>
        </div>
      </dl>

      <p className="text-[15px] leading-relaxed text-ink-soft">{r.description}</p>

      <div className="my-5 rounded-card border-[1.5px] border-dashed border-line bg-paper p-10 text-center text-ink-faint">
        Document preview
      </div>

      <div className="flex flex-wrap gap-2.5">
        <a className="btn-accent" href={r.resource_url} target="_blank" rel="noopener noreferrer">Open Resource</a>
        <button className="btn-ghost" onClick={helpful}>Helpful ↑ {r.helpful_count}</button>
        <button className="btn-ghost" onClick={() => setReporting(true)}>Report</button>
      </div>

      <ReportModal open={reporting} onClose={() => setReporting(false)} targetTitle={r.title} resourceId={r.id} />
    </div>
  )
}
