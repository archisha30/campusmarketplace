import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { CATEGORIES } from '../data/sample.js'

// Same emoji the listing cards use per category, so the page feels connected to the marketplace.
const ICONS = {
  'Textbooks': '📘',
  'Lab Gear': '📐',
  'Electronics': '🔌',
  'Dorm Essentials': '🛏️',
  'Project Kits': '🧰',
  'Sports': '🏸',
  'Clothing & Event Wear': '🧥',
  'F&B': '🍱',
}

export default function Interests() {
  const { user, saveInterests } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(user?.interests || [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (c) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))

  async function finish(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveInterests(selected)
      navigate('/marketplace', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not save your interests. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto my-14 w-full max-w-[560px] rounded-slab border border-line bg-paper p-8 md:p-10">
      <h2 className="mb-2 text-[26px] font-bold">What are you looking for?</h2>
      <p className="mb-6 text-sm text-ink-soft">
        Pick the categories you care about and we'll show those listings first. You can change this later.
      </p>

      <form onSubmit={finish}>
        <div className="mb-3 flex flex-wrap gap-2.5" role="group" aria-label="Interests">
          {CATEGORIES.map((c) => {
            const on = selected.includes(c)
            return (
              <button
                type="button"
                key={c}
                onClick={() => toggle(c)}
                aria-pressed={on}
                className={`rounded-pill border-[1.5px] px-4 py-2.5 text-[14px] font-medium transition ${
                  on ? 'border-brand bg-brand text-white' : 'border-line bg-paper text-ink-soft hover:border-ink'
                }`}
              >
                <span aria-hidden="true" className="mr-1.5">{ICONS[c] || '📦'}</span>
                {c}
              </button>
            )
          })}
        </div>

        <p className="mb-6 text-[13px] text-ink-soft" aria-live="polite">
          {selected.length === 0 ? 'Nothing selected yet' : `${selected.length} selected`}
        </p>

        {error && <p className="mb-3 text-[13px] text-coral">{error}</p>}

        <button className="btn-primary w-full" disabled={busy || selected.length === 0}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
        <button
          type="button"
          className="btn-ghost mt-3 w-full"
          disabled={busy}
          onClick={() => navigate('/marketplace', { replace: true })}
        >
          Skip for now
        </button>
      </form>
    </div>
  )
}
