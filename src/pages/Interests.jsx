import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { CATEGORIES } from '../data/sample.js'
import Icon from '../components/Icon.jsx'
import { categoryStyle } from '../lib/categories.js'

// Same emoji the listing cards use per category, so the page feels connected to the marketplace.
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
    <div className="mx-auto my-14 w-full max-w-[min(560px,calc(100%-32px))] rounded-slab border border-line bg-paper p-8 md:p-10">
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
                className={`pick ${on ? 'pick-on' : ''}`}
              >
                <Icon name={categoryStyle(c).icon} size={18} />
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
