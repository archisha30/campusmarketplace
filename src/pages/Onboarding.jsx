import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Onboarding() {
  const { login, completeProfile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', college: '', course: '', year: '' })
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function finish(e) {
    e.preventDefault()
    setBusy(true)
    await login(form.email || 'student@polaris.edu')
    await completeProfile(form)
    navigate('/marketplace', { replace: true })
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[420px] rounded-slab border border-line bg-paper p-8 md:p-10">
      <h2 className="mb-2 text-[26px] font-bold">Tell us about you</h2>
      <p className="mb-6 text-sm text-ink-soft">A few details so buyers know who they're meeting.</p>

      <form onSubmit={finish}>
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" required className="field-input mb-4" value={form.name} onChange={set('name')} placeholder="Full name" />

        <label className="field-label" htmlFor="college">College</label>
        <input id="college" required className="field-input mb-4" value={form.college} onChange={set('college')} placeholder="Polaris School of Technology" />

        <label className="field-label" htmlFor="course">Course / Branch</label>
        <input id="course" className="field-input mb-4" value={form.course} onChange={set('course')} placeholder="e.g. AI/ML" />

        <label className="field-label" htmlFor="year">Year / Semester</label>
        <input id="year" className="field-input mb-6" value={form.year} onChange={set('year')} placeholder="e.g. 2nd Year, 3rd Semester" />

        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Setting up…' : 'Finish Setup'}</button>
      </form>
    </div>
  )
}
