import { useState } from 'react'
import { Link } from 'react-router-dom'
import { resourcesApi } from '../services/api.js'
import { useApi, useDebounced } from '../hooks/useApi.js'
import { RESOURCE_CATEGORIES } from '../data/sample.js'
import SearchBar from '../components/SearchBar.jsx'
import { Select } from '../components/FilterBar.jsx'
import EmptyState from '../components/EmptyState.jsx'

const DEPARTMENTS = ['All', 'Computer Science', 'Mathematics', 'Electrical Engineering', 'Physics']
const SEMESTERS = ['All', '1st Semester', '2nd Semester', '3rd Semester', '5th Semester']

export default function Resources() {
  const [q, setQ] = useState('')
  const [department, setDepartment] = useState('All')
  const [semester, setSemester] = useState('All')
  const [category, setCategory] = useState('All')
  const debouncedQ = useDebounced(q)

  const { data, loading } = useApi(
    () => resourcesApi.list({ q: debouncedQ, department, semester, category }),
    [debouncedQ, department, semester, category]
  )
  const items = data?.items || []

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <h1 className="text-[30px] font-bold">Resource Hub</h1>
      <p className="mb-6 mt-2.5 text-ink-soft">Study smarter. Share what you've learned.</p>
      <p className="mb-6 max-w-2xl text-[14.5px] text-ink-soft">
        Notes, past year questions, and study guides shared by verified students and faculty on your campus.
        Nothing copyrighted — original student work and links only.
      </p>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <SearchBar value={q} onChange={setQ} placeholder="Search course code, subject, professor…" />
      </div>

      <div className="mb-7 flex flex-wrap gap-2.5">
        <Select label="Department" value={department} onChange={setDepartment} options={DEPARTMENTS.map((d) => ({ value: d, label: d === 'All' ? 'All departments' : d }))} />
        <Select label="Semester" value={semester} onChange={setSemester} options={SEMESTERS.map((s) => ({ value: s, label: s === 'All' ? 'All semesters' : s }))} />
        <Select label="Category" value={category} onChange={setCategory} options={['All', ...RESOURCE_CATEGORIES].map((c) => ({ value: c, label: c === 'All' ? 'All categories' : c }))} />
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[150px]" />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState emoji="📚" title="No resources found" body="Try another course code or subject." />
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <Link key={r.id} to={`/resources/${r.id}`} className="rounded-card border border-line bg-paper p-5 transition hover:border-brand">
              <p className="mb-1.5 font-display text-[13px] font-bold text-brand">{r.course_code}</p>
              <h3 className="mb-2 text-[15.5px] font-semibold">{r.title}</h3>
              <p className="mb-3 text-[12.5px] text-ink-faint">{r.category} · {r.semester}</p>
              <div className="flex items-center justify-between text-[12.5px] text-ink-soft">
                <span>✓ {r.contributor.name}</span>
                <span>Helpful ↑ {r.helpful_count}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
