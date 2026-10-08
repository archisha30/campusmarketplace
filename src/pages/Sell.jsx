import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { CATEGORIES, CONDITIONS, FOOD_CATEGORY, FOOD_TEMPS, LISTING_TYPES } from '../data/sample.js'
import { todayISO } from '../lib/format.js'
import { trackEvent } from '../lib/analytics.js'

const BLANK = {
  title: '', category: CATEGORIES[0], listing_type: 'sale',
  price: '', condition: 'Good', description: '', pickup_spot: '',
  food_temp: '', expiry_date: '', // F&B only
}

export default function Sell() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [existingImages, setExistingImages] = useState([])
  const [loadingListing, setLoadingListing] = useState(isEdit)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Edit mode: load the listing and prefill the form.
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    listingsApi
      .get(id)
      .then((l) => {
        if (cancelled) return
        if (user && String(l.seller?.id) !== String(user.id)) {
          toast('You can only edit your own listings')
          navigate('/dashboard', { replace: true })
          return
        }
        setForm({
          title: l.title || '',
          category: l.category || CATEGORIES[0],
          listing_type: l.listing_type || 'sale',
          price: l.listing_type === 'free' ? '' : String(l.price ?? ''),
          condition: l.condition || 'Good',
          description: l.description || '',
          pickup_spot: l.pickup_spot || '',
          food_temp: l.food_temp || '',
          expiry_date: l.expiry_date || '',
        })
        setExistingImages(l.images || [])
        setLoadingListing(false)
      })
      .catch((err) => {
        if (cancelled) return
        toast(err.message || 'Listing not found')
        navigate('/dashboard', { replace: true })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isFood = form.category === FOOD_CATEGORY
  // Food can be sold or given away, not rented.
  const listingTypes = isFood ? LISTING_TYPES.filter((t) => t.value !== 'rent') : LISTING_TYPES

  function setCategory(e) {
    const category = e.target.value
    setForm((f) => ({
      ...f,
      category,
      listing_type: category === FOOD_CATEGORY && f.listing_type === 'rent' ? 'sale' : f.listing_type,
      condition: category !== FOOD_CATEGORY && f.condition === 'Fresh' ? 'Good' : f.condition,
    }))
  }

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Give the item a title students would search for.'
    if (form.listing_type !== 'free' && (form.price === '' || Number(form.price) < 0)) {
      next.price = 'Enter a price, or switch the listing type to Free.'
    }
    if (!form.pickup_spot.trim()) next.pickup_spot = 'Name a campus spot where you can hand it over.'
    if (isFood && !form.food_temp) next.food_temp = 'Is it served hot or cold?'
    if (isFood && form.expiry_date && form.expiry_date < todayISO()) next.expiry_date = 'That date has already passed.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function publish() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        price: form.listing_type === 'free' ? 0 : Number(form.price),
        // F&B has no wear-and-tear condition; the server stores "Fresh".
        condition: isFood ? 'Fresh' : form.condition,
        food_temp: isFood ? form.food_temp : null,
        expiry_date: isFood && form.expiry_date ? form.expiry_date : null,
      }
      const saved = isEdit
        ? await listingsApi.update(id, { ...payload, images: existingImages })
        : await listingsApi.create(payload)
      if (files.length) await listingsApi.uploadImages(saved?.id ?? id, files)
      if (!isEdit) trackEvent('post_listing', { category: payload.category, listing_type: payload.listing_type })
      toast(isEdit ? 'Changes saved' : 'Published')
      navigate('/dashboard')
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  const photoSlots = Math.max(0, 3 - existingImages.length)

  if (loadingListing) {
    return <div className="mx-auto max-w-[1180px] px-6 py-9 text-ink-soft">Loading listing…</div>
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <h1 className="text-[30px] font-bold">{isEdit ? 'Edit your listing' : 'List something on CampusMarket'}</h1>
      <p className="mb-7 mt-2.5 text-ink-soft">
        {isEdit
          ? 'Update the details below and save your changes.'
          : 'Turn your unused college stuff into cash — or pass it on to someone who needs it.'}
      </p>

      <div className="max-w-[640px] rounded-slab border border-line bg-paper p-6 md:p-9">
        <div className="mb-4">
          <label className="field-label" htmlFor="title">Title</label>
          <input id="title" className="field-input" value={form.title} onChange={set('title')} placeholder="e.g. Casio fx-991CW" />
          {errors.title && <p className="mt-1.5 text-[13px] text-coral">{errors.title}</p>}
        </div>

        <div className="mb-4">
          <label className="field-label" htmlFor="category">Category</label>
          <select id="category" className="field-input" value={form.category} onChange={setCategory}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <fieldset className="mb-4">
          <legend className="field-label">Listing Type</legend>
          <div className="flex gap-2">
            {listingTypes.map((t) => (
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

        {isFood ? (
          <>
            <fieldset className="mb-4">
              <legend className="field-label">Served</legend>
              <div className="flex gap-2">
                {FOOD_TEMPS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={form.food_temp === t.value}
                    onClick={() => setForm((f) => ({ ...f, food_temp: t.value }))}
                    className={`flex-1 rounded-[11px] border-[1.5px] px-2 py-3 text-[13.5px] font-semibold ${
                      form.food_temp === t.value ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-[#fbfbf9] text-ink-soft'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              {errors.food_temp && <p className="mt-1.5 text-[13px] text-coral">{errors.food_temp}</p>}
            </fieldset>

            <div className="mb-4">
              <label className="field-label" htmlFor="expiry">
                Expiry date <span className="font-normal text-ink-faint">(optional)</span>
              </label>
              <input id="expiry" type="date" min={todayISO()} className="field-input" value={form.expiry_date} onChange={set('expiry_date')} />
              <p className="mt-1.5 text-[12.5px] text-ink-faint">After this date the listing is hidden from the marketplace automatically.</p>
              {errors.expiry_date && <p className="mt-1.5 text-[13px] text-coral">{errors.expiry_date}</p>}
            </div>
          </>
        ) : (
          <div className="mb-4">
            <label className="field-label" htmlFor="condition">Condition</label>
            <select id="condition" className="field-input" value={form.condition} onChange={set('condition')}>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className="field-label" htmlFor="description">Description</label>
          <textarea id="description" rows={4} className="field-input resize-y" value={form.description} onChange={set('description')}
            placeholder={isFood ? 'What is it, how many portions, any allergens (nuts, dairy…)?' : "Describe the item, its condition, and why you're passing it on."} />
        </div>

        <div className="mb-4">
          <label className="field-label" htmlFor="pickup">Campus Pickup Spot</label>
          <input id="pickup" className="field-input" value={form.pickup_spot} onChange={set('pickup_spot')} placeholder="e.g. Library Foyer" />
          {errors.pickup_spot && <p className="mt-1.5 text-[13px] text-coral">{errors.pickup_spot}</p>}
        </div>

        <div className="mb-6">
          <label className="field-label" htmlFor="photos">{isEdit ? 'Photos' : 'Upload Photos (1–3)'}</label>
          {existingImages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2.5">
              {existingImages.map((src, i) => (
                <div key={src} className="relative">
                  <img src={src} alt={`Current photo ${i + 1}`}
                    className="h-[70px] w-[70px] rounded-[10px] border border-line object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setExistingImages((imgs) => imgs.filter((u) => u !== src))}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white shadow hover:bg-coral"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {photoSlots === 0 ? (
            <p className="text-[13.5px] text-ink-faint">Maximum of 3 photos reached. Remove one (✕) to add a different photo.</p>
          ) : (
          <div className="rounded-[14px] border-[1.5px] border-dashed border-line bg-[#fbfbf9] p-6 text-center text-[13.5px] text-ink-faint">
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files).slice(0, photoSlots))}
              className="mx-auto mb-2 block"
            />
            {isEdit ? `Add up to ${photoSlots} more image${photoSlots === 1 ? '' : 's'}` : 'PNG or JPG, up to 3 images'}
          </div>
          )}
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
            {saving ? (isEdit ? 'Saving…' : 'Publishing…') : isEdit ? 'Save Changes' : 'Publish Listing'}
          </button>
          {isEdit ? (
            <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Cancel</button>
          ) : (
            <button className="btn-ghost" onClick={() => toast('Draft saved')}>Save Draft</button>
          )}
        </div>
      </div>
    </div>
  )
}
