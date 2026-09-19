import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { CATEGORIES, CONDITIONS, LISTING_TYPES } from '../data/sample.js'

const BLANK = {
  title: '', category: CATEGORIES[0], listing_type: 'sale',
  price: '', condition: 'Good', description: '', pickup_spot: '',
}

export default function Sell() {
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Give the item a title students would search for.'
    if (form.listing_type !== 'free' && (form.price === '' || Number(form.price) < 0)) {
      next.price = 'Enter a price, or switch the listing type to Free.'
    }
    if (!form.pickup_spot.trim()) next.pickup_spot = 'Name a campus spot where you can hand it over.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function publish() {
    if (!validate()) return
    setSaving(true)
    try {
      const created = await listingsApi.create({
        ...form,
        price: form.listing_type === 'free' ? 0 : Number(form.price),
      })
      if (files.length) await listingsApi.uploadImages(created.id, files)
      toast('Published')
      navigate('/dashboard')
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <h1 className="text-[30px] font-bold">List something on CampusMarket</h1>
      <p className="mb-7 mt-2.5 text-ink-soft">
        Turn your unused college stuff into cash — or pass it on to someone who needs it.
      </p>

      <div className="max-w-[640px] rounded-slab border border-line bg-paper p-6 md:p-9">
        <div className="mb-4">
          <label className="field-label" htmlFor="title">Title</label>
          <input id="title" className="field-input" value={form.title} onChange={set('title')} placeholder="e.g. Casio fx-991CW" />
          {errors.title && <p className="mt-1.5 text-[13px] text-coral">{errors.title}</p>}
        </div>

        <div className="mb-4">
          <label className="field-label" htmlFor="category">Category</label>
          <select id="category" className="field-input" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <fieldset className="mb-4">
          <legend className="field-label">Listing Type</legend>
          <div className="flex gap-2">
            {LISTING_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={form.listing_type === t.value}
                onClick={() => setForm((f) => ({ ...f, listing_type: t.value }))}
                className={`flex-1 rounded-[11px] border-[1.5px] px-2 py-3 text-[13.5px] font-semibold ${
                  form.listing_type === t.value ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-[#fbfbf9] text-ink-soft'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        {form.listing_type !== 'free' && (
          <div className="mb-4">
            <label className="field-label" htmlFor="price">Price (₹)</label>
            <input id="price" type="number" min="0" className="field-input" value={form.price} onChange={set('price')} placeholder="e.g. 900" />
            {errors.price && <p className="mt-1.5 text-[13px] text-coral">{errors.price}</p>}
          </div>
        )}

        <div className="mb-4">
          <label className="field-label" htmlFor="condition">Condition</label>
          <select id="condition" className="field-input" value={form.condition} onChange={set('condition')}>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="mb-4">
          <label className="field-label" htmlFor="description">Description</label>
          <textarea id="description" rows={4} className="field-input resize-y" value={form.description} onChange={set('description')}
            placeholder="Describe the item, its condition, and why you're passing it on." />
        </div>

        <div className="mb-4">
          <label className="field-label" htmlFor="pickup">Campus Pickup Spot</label>
          <input id="pickup" className="field-input" value={form.pickup_spot} onChange={set('pickup_spot')} placeholder="e.g. Library Foyer" />
          {errors.pickup_spot && <p className="mt-1.5 text-[13px] text-coral">{errors.pickup_spot}</p>}
        </div>

        <div className="mb-6">
          <label className="field-label" htmlFor="photos">Upload Photos (1–3)</label>
          <div className="rounded-[14px] border-[1.5px] border-dashed border-line bg-[#fbfbf9] p-6 text-center text-[13.5px] text-ink-faint">
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 3))}
              className="mx-auto mb-2 block"
            />
            PNG or JPG, up to 3 images
          </div>
          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              {previews.map((src, i) => (
                <img key={src} src={src} alt={`Upload preview ${i + 1}`} loading="lazy"
                  className="h-[70px] w-[70px] rounded-[10px] border border-line object-cover" />
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2.5">
          <button className="btn-accent" onClick={publish} disabled={saving}>
            {saving ? 'Publishing…' : 'Publish Listing'}
          </button>
          <button className="btn-ghost" onClick={() => toast('Draft saved')}>Save Draft</button>
        </div>
      </div>
    </div>
  )
}
