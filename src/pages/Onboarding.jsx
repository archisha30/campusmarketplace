import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { COLLEGES } from '../data/sample.js'

export default function Onboarding() {
  const { completeProfile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', college: COLLEGES[0], course: '', year: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function finish(e) {
    e.preventDefault()
    setError('')
    // Same rule as the server: a 10-digit Indian mobile number (spaces, +91 or a leading 0 are fine).
    const digits = form.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter a valid 10-digit WhatsApp number')
      return
    }
    setBusy(true)
    try {
      await completeProfile({ ...form, phone: digits })
      navigate('/interests', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[420px] rounded-slab border border-line bg-paper p-8 md:p-10">
      <h2 className="mb-2 text-[26px] font-bold">Tell us about you</h2>
      <p className="mb-6 text-sm text-ink-soft">A few details so buyers know who they're meeting.</p>

      <form onSubmit={finish}>
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" required className="field-input mb-4" value={form.name} onChange={set('name')} placeholder="Full name" />

        <label className="field-label" htmlFor="phone">WhatsApp number</label>
        <div className="flex">
          <span className="flex items-center rounded-l-[11px] border-[1.5px] border-r-0 border-line bg-bg px-3 text-[14px] text-ink-soft">+91</span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            maxLength={14}
            className="field-input rounded-l-none"
            value={form.phone}
            onChange={set('phone')}
            placeholder="10-digit mobile number"
          />
        </div>
        <p className="mb-4 mt-1 text-[12px] text-ink-faint">When someone taps "Contact Seller" on your items, WhatsApp opens a chat with this number.</p>

        <label className="field-label" htmlFor="college">College</label>
        <select id="college" required className="field-input mb-4" value={form.college} onChange={set('college')}>
          {COLLEGES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label className="field-label" htmlFor="course">Course / Branch</label>
        <input id="course" className="field-input mb-4" value={form.course} onChange={set('course')} placeholder="e.g. AI/ML" />

        <label className="field-label" htmlFor="year">Year / Semester</label>
        <input id="year" className="field-input mb-6" value={form.year} onChange={set('year')} placeholder="e.g. 2nd Year, 3rd Semester" />

        {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Setting up…' : 'Finish Setup'}</button>
      </form>
    </div>
  )
}
