import { useState } from 'react'
import { Link } from 'react-router-dom'
import RequestCard from '../components/RequestCard.jsx'
import RequestMatches from '../components/RequestMatches.jsx'
import Reveal from '../components/Reveal.jsx'
import { useApi } from '../hooks/useApi.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useRequestNotifications } from '../hooks/useRequestNotifications.js'
import { useToast } from '../hooks/useToast.jsx'
import { trackEvent } from '../lib/analytics.js'
import { categoryStyle } from '../lib/categories.js'
import { NEEDED_BY, PRODUCT_MAX, REQUEST_CATEGORIES, buildDetails, noteMax } from '../lib/requests.js'
import { requestsApi } from '../services/api.js'

const BLANK = { product: '', category: '', budget: '', neededBy: '', note: '' }
const PREVIEW = 5 // requests shown before "Show all"

// "Looking for something?": post a request, beside what other students are looking for.
export default function PostRequest() {
  const { isSeller } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [matches, setMatches] = useState(null)
  const mine = useApi(() => (isSeller ? Promise.resolve([]) : requestsApi.mine()), [isSeller])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  // Tapping the chosen answer again clears it: only "What do you need?" is required.
  const toggle = (k, v) => set(k, form[k] === v ? '' : v)
  const left = noteMax(form)
  const pick = (on) => `pick ${on ? 'pick-on' : ''}`

  async function submit(e) {
    e.preventDefault()
    if (!form.product.trim()) return setError("Tell sellers what you're looking for")
    if (form.note.trim().length > left) return setError(`Shorten the note to ${left} characters`)
    setBusy(true)
    setError('')
    try {
      const posted = await requestsApi.create({ product: form.product.trim(), description: buildDetails(form) })
      setForm(BLANK)
      if (!isSeller) mine.refetch()
      const listings = posted.matches || []
      const resources = posted.resource_matches || []
      if (listings.length || resources.length) {
        toast('Request sent to sellers')
        trackEvent('request_matched', { matches: listings.length, resource_matches: resources.length })
        setMatches({ listings, resources })
      } else {
        toast("Request sent to sellers. We'll let you know when a match is listed.")
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap flex flex-col gap-12 py-8 md:py-12 lg:flex-row lg:items-start lg:gap-16">
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-8 lg:w-[560px] lg:shrink">
        <div>
          <h1 className="page-title">Looking for something?</h1>
          <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
            Post what you need. Students who have it can message you on WhatsApp or email.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="req-product">What do you need?</label>
          <input
            id="req-product"
            required
            maxLength={PRODUCT_MAX}
            className="field-input"
            value={form.product}
            onChange={(e) => set('product', e.target.value)}
            placeholder="e.g. Casio fx-991CW calculator"
          />
        </div>

        <fieldset>
          <legend className="field-label">Category <span className="font-normal text-ink-soft">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {REQUEST_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={form.category === c} className={pick(form.category === c)} onClick={() => toggle('category', c)}>
                {c !== 'Other' && <span className="dot" style={{ background: categoryStyle(c).dot }} />}{c}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="field-label" htmlFor="req-budget">Budget <span className="font-normal text-ink-soft">(optional)</span></label>
          <div className="relative max-w-[240px]">
            <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">Up to ₹</span>
            <input
              id="req-budget"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              className="field-input pl-[84px]"
              value={form.budget}
              onChange={(e) => set('budget', e.target.value.replace(/\D/g, ''))}
              placeholder="300"
            />
          </div>
        </div>

        <fieldset>
          <legend className="field-label">Needed by <span className="font-normal text-ink-soft">(optional)</span></legend>
          <div className="flex flex-wrap gap-2">
            {NEEDED_BY.map((n) => (
              <button key={n.value} type="button" aria-pressed={form.neededBy === n.value} className={pick(form.neededBy === n.value)} onClick={() => toggle('neededBy', n.value)}>
                {n.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="field-label" htmlFor="req-note">Anything else? <span className="font-normal text-ink-soft">(optional)</span></label>
            <span className={`text-[13px] tabular-nums ${form.note.length >= left ? 'text-coral' : 'text-ink-soft'}`}>{form.note.length}/{left}</span>
          </div>
          <textarea
            id="req-note"
            maxLength={left}
            className="field-input resize-y"
            value={form.note}
            onChange={(e) => set('note', e.target.value.replace(/[\r\n]+/g, ' '))}
            placeholder="e.g. Any condition is fine, can rent too"
          />
        </div>

        <div>
          {error && <p role="alert" className="mb-4 text-sm text-coral">{error}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post request'}</button>
            <p className="text-sm text-ink-soft">
              Requests close automatically after 30 days. <Link to="/profile#requests" className="font-semibold text-brand hover:underline">Your requests</Link>
            </p>
          </div>
        </div>
      </form>

      <aside className="min-w-0 flex-1">
        {isSeller ? <CampusRequests /> : (
          <RequestList
            title="Your requests"
            blurb="Sellers on campus can see these and message you."
            empty="You haven't posted any requests yet."
            loading={mine.loading}
            error={mine.error}
            items={mine.data || []}
          />
        )}
      </aside>

      <RequestMatches matches={matches} onClose={() => setMatches(null)} />
    </div>
  )
}

// Other students' requests: only sellers may load them.
function CampusRequests() {
  const { items, loading } = useRequestNotifications({ freeze: true })
  return (
    <RequestList
      title="Recent requests on campus"
      blurb="Got one of these? Message the student and make a quick sale."
      empty="No requests right now. You'll see them here when students post one."
      loading={loading}
      items={items}
      canReply
    />
  )
}

function RequestList({ title, blurb, empty, loading, error, items, canReply }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, PREVIEW)
  return (
    <section>
      <h2 className="text-2xl leading-tight">{title}</h2>
      <p className="mb-6 mt-2 text-sm text-ink-soft">{blurb}</p>
      {loading ? (
        <div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[120px]" />)}</div>
      ) : error ? (
        <p className="card p-6 text-[15px] text-coral">{error.message}</p>
      ) : items.length === 0 ? (
        <p className="card p-6 text-[15px] leading-relaxed text-ink-soft">{empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((r, i) => <Reveal key={r.id} i={i}><RequestCard r={r} canReply={canReply} /></Reveal>)}
          {items.length > PREVIEW && (
            <button type="button" className="btn-ghost btn-sm self-start" onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `Show all ${items.length} requests`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
