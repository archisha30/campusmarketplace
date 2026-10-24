import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useDraft } from '../hooks/useDraft.js'
import { CATEGORIES, CONDITIONS, FOOD_CATEGORY, FOOD_TEMPS, LISTING_TYPES } from '../data/sample.js'
import { timeAgo, todayISO } from '../lib/format.js'
import { trackEvent } from '../lib/analytics.js'
import { shrinkToJpeg } from '../lib/images.js'
import PriceTag from '../components/PriceTag.jsx'
import { revealFirstError } from '../lib/forms.js'

const BLANK = {
  title: '', category: CATEGORIES[0], listing_type: 'sale',
  price: '', mrp: '', condition: 'Good', description: '', pickup_spot: '',
  food_temp: '', expiry_date: '', // F&B only
}

const WHOLE = /^\d+$/ // prices are whole rupees, no paise
// Typing "." or "," into a price box does nothing.
const blockDecimals = (e) => { if (['.', ',', 'e', 'E', '-', '+'].includes(e.key)) e.preventDefault() }

// Error keys in the order the fields appear, for scrolling to the first problem.
const FIELD_ORDER = ['title', 'price', 'mrp', 'food_temp', 'expiry_date', 'description', 'pickup_spot', 'photos']

// A saved draft back into form state (drafts keep the fields as typed, all strings).
function fromDraft(data) {
  const form = { ...BLANK }
  for (const k of Object.keys(BLANK)) if (data[k] != null) form[k] = String(data[k])
  if (!CATEGORIES.includes(form.category)) form.category = BLANK.category
  return form
}

const isBlank = (form) => Object.keys(BLANK).every((k) => String(form[k]).trim() === String(BLANK[k]))

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
  const { draftId, loadingDraft, savingDraft, savedAt, saveDraft, discardDraft } = useDraft('listing', {
    enabled: !isEdit,
    onLoad: (data) => { setForm(fromDraft(data)); setErrors({}) },
    onMissing: (err) => toast(err.message || 'Draft not found'),
  })

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
          mrp: l.mrp ? String(l.mrp) : '',
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

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined })) // fixed it: drop the red
  }
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
    } else if (form.listing_type !== 'free' && !WHOLE.test(String(form.price).trim())) {
      next.price = 'Use a whole number of rupees, without paise (e.g. 450).'
    }
    if (form.listing_type === 'sale' && form.mrp !== '') {
      if (!(Number(form.mrp) > 0)) next.mrp = 'Enter the MRP in rupees, or leave it blank.'
      else if (!WHOLE.test(String(form.mrp).trim())) next.mrp = 'Use a whole number of rupees, without paise.'
      else if (form.price !== '' && Number(form.mrp) < Number(form.price)) next.mrp = "MRP can't be lower than your selling price."
    }
    if (!form.description.trim()) next.description = isFood
      ? 'Describe it: what it is, how many portions, any allergens.'
      : "Describe the item and its condition, so buyers know what they're getting."
    if (!form.pickup_spot.trim()) next.pickup_spot = 'Name a campus spot where you can hand it over.'
    if (isFood && !form.food_temp) next.food_temp = 'Is it served hot or cold?'
    if (isFood && form.expiry_date && form.expiry_date < todayISO()) next.expiry_date = 'That date has already passed.'
    if (existingImages.length + files.length === 0) next.photos = 'Add at least one photo of the item.'
    setErrors(next)
    const problems = FIELD_ORDER.filter((k) => next[k])
    if (problems.length) {
      toast(problems.length === 1 ? next[problems[0]] : `${problems.length} things need fixing. ${next[problems[0]]}`)
      revealFirstError(next, FIELD_ORDER)
    }
    return problems.length === 0
  }

  async function publish() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        price: form.listing_type === 'free' ? 0 : Number(form.price),
        mrp: form.listing_type === 'sale' && form.mrp !== '' ? Number(form.mrp) : null,
        // F&B has no wear-and-tear condition; the server stores "Fresh".
        condition: isFood ? 'Fresh' : form.condition,
        food_temp: isFood ? form.food_temp : null,
        expiry_date: isFood && form.expiry_date ? form.expiry_date : null,
      }
      // Shrink to JPEGs (max 1600px) first: big phone photos upload faster and stay under the server limit.
      // They go up with the listing in one request, so it's never saved without its photos.
      const photos = await Promise.all(files.map((f, i) => shrinkToJpeg(f, { maxSize: 1600, quality: 0.85, name: `photo-${i + 1}.jpg` })))
      if (isEdit) await listingsApi.update(id, { ...payload, images: existingImages }, photos)
      else await listingsApi.create(payload, photos)
      if (!isEdit) discardDraft()
      if (!isEdit) trackEvent('post_listing', { category: payload.category, listing_type: payload.listing_type })
      toast(isEdit ? 'Changes saved' : 'Published')
      navigate('/dashboard')
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onSaveDraft() {
    if (isBlank(form)) {
      toast('Fill in something first, like a title')
      return
    }
    try {
      await saveDraft(form)
      toast(files.length
        ? "Draft saved. Photos aren't kept in drafts, so add them again when you publish"
        : 'Draft saved. Find it under Drafts on your dashboard')
    } catch (err) {
      toast(err.message || "Couldn't save the draft")
    }
  }

  const photoSlots = Math.max(0, 3 - existingImages.length)

  if (loadingListing || loadingDraft) {
    return <div className="mx-auto max-w-[1180px] px-6 py-9 text-ink-soft">{loadingDraft ? 'Loading draft…' : 'Loading listing…'}</div>
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
        {draftId && (
          <p className="mb-5 rounded-[10px] bg-brand-tint px-3 py-2 text-[13px] text-brand-deep">
            📝 You're working on a draft{savedAt ? `, last saved ${timeAgo(savedAt)}` : ''}. Photos aren't kept in drafts, so add them before you publish.
          </p>
        )}
        <div className="mb-4" data-field="title">
          <label className="field-label" htmlFor="title">Title</label>
          <input id="title" className="field-input" aria-invalid={Boolean(errors.title)} value={form.title} onChange={set('title')} placeholder="e.g. Casio fx-991CW" />
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
          <div className={`mb-4 grid gap-3 ${form.listing_type === 'sale' ? 'grid-cols-2' : ''}`}>
            <div data-field="price">
              <label className="field-label" htmlFor="price">{form.listing_type === 'sale' ? 'Selling price (₹)' : 'Price (₹)'}</label>
              <input id="price" type="number" min="0" step="1" inputMode="numeric" onKeyDown={blockDecimals} className="field-input" aria-invalid={Boolean(errors.price)} value={form.price} onChange={set('price')} placeholder="e.g. 900" />
              {errors.price && <p className="mt-1.5 text-[13px] text-coral">{errors.price}</p>}
            </div>
            {form.listing_type === 'sale' && (
              <div data-field="mrp">
                <label className="field-label" htmlFor="mrp">MRP (₹) <span className="font-normal text-ink-faint">optional</span></label>
                <input id="mrp" type="number" min="1" step="1" inputMode="numeric" onKeyDown={blockDecimals} className="field-input" aria-invalid={Boolean(errors.mrp)} value={form.mrp} onChange={set('mrp')} placeholder="What you paid" />
                {errors.mrp && <p className="mt-1.5 text-[13px] text-coral">{errors.mrp}</p>}
              </div>
            )}
            {form.listing_type === 'sale' && Number(form.mrp) > Number(form.price) && Number(form.price) > 0 && (
              <div className="col-span-2 flex items-baseline gap-2 rounded-[10px] bg-brand-tint px-3 py-2 text-[12.5px] text-brand-deep">
                <span>Buyers will see:</span>
                <PriceTag price={Number(form.price)} mrp={Number(form.mrp)} size="sm" />
              </div>
            )}
          </div>
        )}

        {isFood ? (
          <>
            <fieldset className="mb-4" data-field="food_temp">
              <legend className="field-label">Served</legend>
              <div className="flex gap-2">
                {FOOD_TEMPS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={form.food_temp === t.value}
                    onClick={() => { setForm((f) => ({ ...f, food_temp: t.value })); setErrors((x) => ({ ...x, food_temp: undefined })) }}
                    className={`flex-1 rounded-[11px] border-[1.5px] px-2 py-3 text-[13.5px] font-semibold ${
                      form.food_temp === t.value ? 'border-brand bg-brand-tint text-brand' : errors.food_temp ? 'border-coral bg-coral/5 text-ink-soft' : 'border-line bg-[#fbfbf9] text-ink-soft'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              {errors.food_temp && <p className="mt-1.5 text-[13px] text-coral">{errors.food_temp}</p>}
            </fieldset>

            <div className="mb-4" data-field="expiry_date">
              <label className="field-label" htmlFor="expiry">
                Expiry date <span className="font-normal text-ink-faint">(optional)</span>
              </label>
              <input id="expiry" type="date" min={todayISO()} className="field-input" aria-invalid={Boolean(errors.expiry_date)} value={form.expiry_date} onChange={set('expiry_date')} />
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

        <div className="mb-4" data-field="description">
          <label className="field-label" htmlFor="description">Description</label>
          <textarea id="description" rows={4} maxLength={2000} className="field-input resize-y" aria-invalid={Boolean(errors.description)} value={form.description} onChange={set('description')}
            placeholder={isFood ? 'What is it, how many portions, any allergens (nuts, dairy…)?' : "Describe the item, its condition, and why you're passing it on."} />
          {errors.description && <p className="mt-1.5 text-[13px] text-coral">{errors.description}</p>}
        </div>

        <div className="mb-4" data-field="pickup_spot">
          <label className="field-label" htmlFor="pickup">Campus Pickup Spot</label>
          <input id="pickup" className="field-input" aria-invalid={Boolean(errors.pickup_spot)} value={form.pickup_spot} onChange={set('pickup_spot')} placeholder="e.g. Library Foyer" />
          {errors.pickup_spot && <p className="mt-1.5 text-[13px] text-coral">{errors.pickup_spot}</p>}
        </div>

        <div className="mb-6" data-field="photos">
          <label className="field-label" htmlFor="photos">{isEdit ? 'Photos (1–3)' : 'Upload Photos (1–3)'}</label>
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
          <div className={`rounded-[14px] border-[1.5px] border-dashed p-6 text-center text-[13.5px] text-ink-faint ${errors.photos ? 'border-coral bg-coral/5' : 'border-line bg-[#fbfbf9]'}`}>
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                setFiles(Array.from(e.target.files).slice(0, photoSlots))
                setErrors((x) => ({ ...x, photos: undefined }))
              }}
              className="mx-auto mb-2 block"
            />
            {isEdit ? `Add up to ${photoSlots} more image${photoSlots === 1 ? '' : 's'}` : 'At least one photo, up to 3 (PNG or JPG)'}
          </div>
          )}
          {errors.photos && <p className="mt-1.5 text-[13px] text-coral">{errors.photos}</p>}
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
          <button className="btn-accent" onClick={publish} disabled={saving || savingDraft}>
            {saving ? (isEdit ? 'Saving…' : 'Publishing…') : isEdit ? 'Save Changes' : 'Publish Listing'}
          </button>
          {isEdit ? (
            <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Cancel</button>
          ) : (
            <button className="btn-ghost" onClick={onSaveDraft} disabled={saving || savingDraft}>
              {savingDraft ? 'Saving…' : draftId ? 'Update Draft' : 'Save Draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
