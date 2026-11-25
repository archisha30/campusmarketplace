import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listingsApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useDraft } from '../hooks/useDraft.js'
import { CATEGORIES, CONDITIONS, FOOD_CATEGORY, FOOD_TEMPS, LISTING_TYPES, RENT_PERIODS } from '../data/sample.js'
import { timeAgo, todayISO } from '../lib/format.js'
import { trackEvent } from '../lib/analytics.js'
import { shrinkToJpeg } from '../lib/images.js'
import Icon from '../components/Icon.jsx'
import { ListingCardView } from '../components/ListingCard.jsx'
import { categoryStyle } from '../lib/categories.js'
import PriceTag from '../components/PriceTag.jsx'
import { revealFirstError } from '../lib/forms.js'

const BLANK = {
  title: '', category: CATEGORIES[0], listing_type: 'sale',
  price: '', mrp: '', condition: 'Good', description: '', pickup_spot: '',
  rent_days: '', security_deposit: '', // rentals only
  food_temp: '', expiry_date: '', // F&B only
}

const WHOLE = /^\d+$/ // prices are whole rupees, no paise
// Rupee boxes take digits only: a text box (number boxes still allow "e", "." and "-")
// with the number keypad on phones; anything else typed or pasted is dropped.
const RUPEES = { type: 'text', inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'off', maxLength: 7 }

// Error keys in the order the fields appear, for scrolling to the first problem.
const FIELD_ORDER = ['photos', 'title', 'food_temp', 'expiry_date', 'price', 'rent_days', 'mrp', 'security_deposit', 'description', 'pickup_spot']

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
          rent_days: l.rent_days ? String(l.rent_days) : '',
          security_deposit: l.security_deposit ? String(l.security_deposit) : '',
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
  // Rupee boxes: keep the digits only, whatever was typed or pasted.
  const setDigits = (k) => (e) => set(k)({ target: { value: e.target.value.replace(/\D/g, '') } })
  const isFood = form.category === FOOD_CATEGORY
  const isRent = form.listing_type === 'rent'
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
    if (isRent && !form.rent_days) next.rent_days = "Choose how long you're renting it out for."
    if (isRent && form.security_deposit !== '' && !WHOLE.test(String(form.security_deposit).trim())) {
      next.security_deposit = 'Use a whole number of rupees, or leave it blank.'
    }
    if (form.listing_type !== 'free' && form.mrp !== '') {
      if (!(Number(form.mrp) > 0)) next.mrp = 'Enter the MRP in rupees, or leave it blank.'
      else if (!WHOLE.test(String(form.mrp).trim())) next.mrp = 'Use a whole number of rupees, without paise.'
      else if (!isRent && form.price !== '' && Number(form.mrp) < Number(form.price)) next.mrp = "MRP can't be lower than your selling price."
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
        mrp: form.listing_type !== 'free' && form.mrp !== '' ? Number(form.mrp) : null,
        rent_days: isRent ? Number(form.rent_days) : null,
        security_deposit: isRent && Number(form.security_deposit) > 0 ? Number(form.security_deposit) : null,
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
    return <div className="wrap py-9 text-ink-soft">{loadingDraft ? 'Loading draft…' : 'Loading listing…'}</div>
  }

  const pick = (on) => `pick ${on ? 'pick-on' : ''}`
  const photoCount = existingImages.length + files.length
  const err = (k) => errors[k] && <p className="field-error">{errors[k]}</p>

  return (
    <div className="wrap flex flex-col gap-12 py-8 md:py-12 lg:flex-row lg:items-start lg:gap-16">
      <div className="flex min-w-0 flex-col gap-8 lg:w-[720px] lg:flex-none lg:shrink">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit your listing' : 'Post a listing'}</h1>
          <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
            {isEdit
              ? 'Update the details below and save your changes.'
              : 'Takes about a minute. Interested students message you directly.'}
          </p>
        </div>

        {draftId && (
          <p className="flex gap-3 rounded-control bg-brand-tint p-4 text-sm leading-relaxed text-brand-deep">
            <Icon name="pencil" />
            <span>You're working on a draft{savedAt ? `, last saved ${timeAgo(savedAt)}` : ''}. Photos aren't kept in drafts, so add them before you publish.</span>
          </p>
        )}

        <div data-field="photos">
          <span className="field-label">Photos</span>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
            {existingImages.map((src, i) => (
              <div key={src} className="relative aspect-square">
                <img src={src} alt={`Current photo ${i + 1}`} className="h-full w-full rounded-control object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setExistingImages((imgs) => imgs.filter((u) => u !== src))}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-control border border-line bg-paper text-ink hover:text-coral"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            ))}
            {previews.map((src, i) => (
              <img key={src} src={src} alt={`Upload preview ${i + 1}`} className="aspect-square w-full rounded-control object-cover" />
            ))}
            {photoSlots > 0 && (
              <label
                htmlFor="photos"
                className={`lift relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed bg-paper p-2 text-center text-sm font-semibold focus-within:border-brand ${errors.photos ? 'border-coral' : 'border-line-strong'}`}
              >
                <Icon name="camera" size={24} className="text-brand" />
                {files.length > 0 ? 'Change photos' : 'Add photo'}
                <input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files).slice(0, photoSlots))
                    setErrors((x) => ({ ...x, photos: undefined }))
                  }}
                  className="sr-only"
                />
              </label>
            )}
          </div>
          <p className="field-help">
            {photoSlots === 0
              ? 'Maximum of 3 photos reached. Remove one to add a different photo.'
              : isEdit
                ? `Add up to ${photoSlots} more image${photoSlots === 1 ? '' : 's'}. Natural light and a plain background work best.`
                : `At least one photo, up to 3 (PNG or JPG)${photoCount > 1 ? '' : '. Pick them all at once'}.`}
          </p>
          {err('photos')}
        </div>

        <div data-field="title">
          <label className="field-label" htmlFor="title">Title</label>
          <input id="title" className="field-input" aria-invalid={Boolean(errors.title)} value={form.title} onChange={set('title')} placeholder="e.g. Casio fx-991CW" />
          {err('title')}
        </div>

        <fieldset>
          <legend className="field-label">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={form.category === c} className={pick(form.category === c)}
                onClick={() => setCategory({ target: { value: c } })}>
                <span className="dot" style={{ background: categoryStyle(c).dot }} />{c}
              </button>
            ))}
          </div>
        </fieldset>

        {isFood ? (
          <>
            <fieldset data-field="food_temp">
              <legend className="field-label">Served</legend>
              <div className="flex flex-wrap gap-2">
                {FOOD_TEMPS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={form.food_temp === t.value}
                    onClick={() => { setForm((f) => ({ ...f, food_temp: t.value })); setErrors((x) => ({ ...x, food_temp: undefined })) }}
                    className={`${pick(form.food_temp === t.value)} ${errors.food_temp ? 'border-coral' : ''}`}
                  >
                    <Icon name={t.value === 'hot' ? 'flame' : 'snowflake'} size={18} />{t.label}
                  </button>
                ))}
              </div>
              {err('food_temp')}
            </fieldset>

            <div data-field="expiry_date">
              <label className="field-label" htmlFor="expiry">
                Expiry date <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input id="expiry" type="date" min={todayISO()} className="field-input max-w-[280px]" aria-invalid={Boolean(errors.expiry_date)} value={form.expiry_date} onChange={set('expiry_date')} />
              <p className="field-help">After this date the listing is hidden from the marketplace automatically.</p>
              {err('expiry_date')}
            </div>
          </>
        ) : (
          <fieldset>
            <legend className="field-label">Condition</legend>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button key={c} type="button" aria-pressed={form.condition === c} className={pick(form.condition === c)}
                  onClick={() => set('condition')({ target: { value: c } })}>
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="field-label">Listing type</legend>
          <div className="flex flex-wrap gap-2">
            {listingTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={form.listing_type === t.value}
                onClick={() => setForm((f) => ({ ...f, listing_type: t.value }))}
                className={pick(form.listing_type === t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        {form.listing_type !== 'free' && (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div data-field="price">
              <label className="field-label" htmlFor="price">{isRent ? 'Rent' : 'Price'}</label>
              <Rupees><input id="price" {...RUPEES} className="field-input pl-9" aria-invalid={Boolean(errors.price)} value={form.price} onChange={setDigits('price')} placeholder={isRent ? 'e.g. 300' : 'e.g. 900'} /></Rupees>
              {err('price')}
            </div>
            {isRent && (
              <div data-field="rent_days">
                <label className="field-label" htmlFor="rent_days">Rented for</label>
                <select id="rent_days" className="field-input" aria-invalid={Boolean(errors.rent_days)} value={form.rent_days} onChange={set('rent_days')}>
                  <option value="" disabled>Select</option>
                  {RENT_PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
                </select>
                {err('rent_days')}
              </div>
            )}
            <div data-field="mrp">
              <label className="field-label" htmlFor="mrp">MRP <span className="font-normal text-ink-soft">(optional)</span></label>
              <Rupees><input id="mrp" {...RUPEES} className="field-input pl-9" aria-invalid={Boolean(errors.mrp)} value={form.mrp} onChange={setDigits('mrp')} placeholder="What you paid" /></Rupees>
              {err('mrp')}
            </div>
            {isRent && (
              <div data-field="security_deposit">
                <label className="field-label" htmlFor="deposit">Security deposit</label>
                <Rupees><input id="deposit" {...RUPEES} className="field-input pl-9" aria-invalid={Boolean(errors.security_deposit)} value={form.security_deposit} onChange={setDigits('security_deposit')} placeholder="Optional" /></Rupees>
                {err('security_deposit')}
              </div>
            )}
            {Number(form.price) > 0 && (isRent ? form.rent_days : Number(form.mrp) > Number(form.price)) && (
              <div className="flex flex-wrap items-baseline gap-x-2 rounded-control bg-brand-tint px-4 py-3 text-sm text-brand-deep sm:col-span-2">
                <span>{isRent ? 'Renters will see:' : 'Buyers will see:'}</span>
                <PriceTag price={Number(form.price)} mrp={Number(form.mrp) || null} listingType={form.listing_type}
                  rentDays={Number(form.rent_days) || null} deposit={Number(form.security_deposit) || null} size="sm" />
              </div>
            )}
          </div>
        )}

        <div data-field="description">
          <label className="field-label" htmlFor="description">Description</label>
          <textarea id="description" rows={4} maxLength={2000} className="field-input resize-y" aria-invalid={Boolean(errors.description)} value={form.description} onChange={set('description')}
            placeholder={isFood ? 'What is it, how many portions, any allergens (nuts, dairy…)?' : "Describe the item, its condition, and why you're passing it on."} />
          {err('description')}
        </div>

        <div data-field="pickup_spot">
          <label className="field-label" htmlFor="pickup">Pickup spot</label>
          <input id="pickup" className="field-input" aria-invalid={Boolean(errors.pickup_spot)} value={form.pickup_spot} onChange={set('pickup_spot')} placeholder="e.g. Library Foyer" />
          {err('pickup_spot')}
        </div>

        {user?.phone && (
          <div>
            <span className="field-label">Contact</span>
            <div className="card flex items-center gap-4 p-4">
              <Icon name="message-circle" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">WhatsApp +91 ••••• •{String(user.phone).slice(-4)}</p>
                <p className="mt-1 text-sm text-ink-soft">Buyers tap “Contact seller” to message you. Your number isn't shown on the listing.</p>
              </div>
              {/* A new tab, so what's typed here isn't lost. */}
              <Link to="/profile" target="_blank" className="text-sm font-semibold underline">Change</Link>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <button className="btn-primary" onClick={publish} disabled={saving || savingDraft}>
            {saving ? (isEdit ? 'Saving…' : 'Publishing…') : isEdit ? 'Save changes' : 'Post listing'}
          </button>
          {isEdit ? (
            <button className="btn-secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
          ) : (
            <button className="btn-secondary" onClick={onSaveDraft} disabled={saving || savingDraft}>
              {savingDraft ? 'Saving…' : draftId ? 'Update draft' : 'Save draft'}
            </button>
          )}
        </div>
      </div>

      <aside className="w-full max-w-[320px] lg:sticky lg:top-28">
        <p className="field-label !mb-4">Preview</p>
        <ListingCardView
          photo={existingImages[0] || previews[0]}
          listing={{
            title: form.title.trim() || 'Your title',
            category: form.category,
            listing_type: form.listing_type,
            price: form.listing_type === 'free' ? 0 : form.price === '' ? null : Number(form.price),
            mrp: form.listing_type === 'free' ? null : Number(form.mrp) || null,
            rent_days: form.rent_days,
            condition: form.condition,
            food_temp: isFood ? form.food_temp : null,
            expiry_date: isFood ? form.expiry_date : null,
            seller: { campus: user?.college || user?.campus },
          }}
        />
        <p className="mt-4 text-sm text-ink-soft">This is how your listing appears in the marketplace.</p>
      </aside>
    </div>
  )
}

// A rupee sign inside the left of a price box.
function Rupees({ children }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">₹</span>
      {children}
    </div>
  )
}
