import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { resourcesApi } from '../services/api.js'
import { useToast } from '../hooks/useToast.jsx'
import { trackEvent } from '../lib/analytics.js'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  DESCRIPTION_MAX, MAX_PDF_MB, SUBJECTS, YEARS, canonicalSubject, checkPdfFile, isAllowedDriveUrl,
} from '../lib/resources.js'

const OTHER = '__other__'

const BLANK = {
  title: '', subject: '', year: 'any', copy_type: 'soft', offer_type: 'sale', price: '',
  description: '', delivery: 'pdf', drive_url: '', pickup_spot: '', upi_id: '',
}

function Segmented({ legend, value, onChange, options }) {
  return (
    <fieldset className="mb-4">
      <legend className="field-label">{legend}</legend>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[11px] border-[1.5px] px-2 py-3 text-[13.5px] font-semibold ${
              value === o.value ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-[#fbfbf9] text-ink-soft'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function FieldError({ msg }) {
  return msg ? <p className="mt-1.5 text-[13px] text-coral">{msg}</p> : null
}

export default function ResourceForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [existing, setExisting] = useState(null) // { has_file, page_count } in edit mode
  const [removeFile, setRemoveFile] = useState(false)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loadingResource, setLoadingResource] = useState(isEdit)
  // Subject is a dropdown of SUBJECTS plus "Other", which reveals a text box.
  const [otherSubject, setOtherSubject] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    resourcesApi
      .get(id)
      .then((r) => {
        if (cancelled) return
        if (r.access?.reason !== 'owner') {
          toast('You can only edit your own resources')
          navigate(`/resources/${id}`, { replace: true })
          return
        }
        setForm({
          title: r.title, subject: canonicalSubject(r.subject), year: r.year, copy_type: r.copy_type, offer_type: r.offer_type,
          price: r.offer_type === 'sale' ? String(r.price) : '', description: r.description || '',
          delivery: r.delivery || 'pdf', drive_url: r.drive_url || '', pickup_spot: r.pickup_spot || '',
          upi_id: r.upi_id || '',
        })
        setOtherSubject(!SUBJECTS.includes(canonicalSubject(r.subject)))
        setExisting({ has_file: r.has_file, page_count: r.page_count })
        setLoadingResource(false)
      })
      .catch((err) => {
        if (cancelled) return
        toast(err.message || 'Resource not found')
        navigate('/resources', { replace: true })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const choose = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const soft = form.copy_type === 'soft'
  const fileRole = soft && form.delivery === 'pdf' ? 'full' : soft ? 'sample-required' : 'sample-optional'
  const keepsFile = Boolean(existing?.has_file) && !removeFile
  const hasFile = Boolean(file) || keepsFile

  async function pickFile(e) {
    const f = e.target.files?.[0] || null
    e.target.value = ''
    if (!f) return
    const problem = await checkPdfFile(f)
    if (problem) {
      setErrors((x) => ({ ...x, file: problem }))
      setFile(null)
      return
    }
    setErrors((x) => ({ ...x, file: undefined }))
    setFile(f)
    setRemoveFile(false)
  }

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Give it a title students would search for.'
    if (!form.subject.trim()) next.subject = otherSubject ? 'Type the subject name.' : 'Pick a subject.'
    if (form.offer_type === 'sale' && !/^\d+$/.test(String(form.price).trim())) {
      next.price = 'Enter a whole-rupee price, e.g. 50.'
    } else if (form.offer_type === 'sale' && Number(form.price) < 1) {
      next.price = 'A sale needs a price of at least ₹1, or switch to Free.'
    }
    if (form.description.length > DESCRIPTION_MAX) next.description = `Keep it under ${DESCRIPTION_MAX} characters.`
    if (soft && form.delivery === 'drive' && !isAllowedDriveUrl(form.drive_url.trim())) {
      next.drive_url = 'Use an https link from Google Drive/Docs, OneDrive, SharePoint, Dropbox or Mega.'
    }
    if (!soft && !form.pickup_spot.trim()) next.pickup_spot = 'Name a campus spot where you can hand it over.'
    if (form.upi_id.trim() && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/.test(form.upi_id.trim())) {
      next.upi_id = 'Enter a UPI ID like name@okbank.'
    }
    if (fileRole === 'full' && !hasFile) next.file = 'Upload the PDF you’re sharing.'
    if (fileRole === 'sample-required' && !hasFile) next.file = 'Drive links need a sample PDF so students can preview it.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function save() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        subject: canonicalSubject(form.subject),
        year: form.year,
        copy_type: form.copy_type,
        offer_type: form.offer_type,
        price: form.offer_type === 'free' ? 0 : Number(form.price),
        description: form.description,
        delivery: soft ? form.delivery : '',
        drive_url: soft && form.delivery === 'drive' ? form.drive_url.trim() : '',
        pickup_spot: soft ? '' : form.pickup_spot.trim(),
        upi_id: form.upi_id.trim(),
      }
      const saved = isEdit
        ? await resourcesApi.update(id, payload, file, removeFile && !file)
        : await resourcesApi.create(payload, file)
      if (!isEdit) trackEvent('post_resource', { subject: payload.subject, copy_type: payload.copy_type, offer_type: payload.offer_type })
      toast(isEdit ? 'Changes saved' : 'Resource posted')
      navigate(`/resources/${saved?.id ?? id}`)
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loadingResource) {
    return <div className="mx-auto max-w-[1180px] px-6 py-9 text-ink-soft">Loading resource…</div>
  }

  const fileLabel = {
    full: 'PDF',
    'sample-required': 'Sample PDF (required)',
    'sample-optional': 'Sample PDF (optional)',
  }[fileRole]
  const fileHint = {
    full: 'The full resource. Page 1 is shown as a preview; the rest stays locked until access is given.',
    'sample-required': 'A few pages from the drive content, so students can preview it before buying.',
    'sample-optional': 'Scan a few pages of the printed copy so students know what they’re getting.',
  }[fileRole]

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-9">
      <h1 className="text-[30px] font-bold">{isEdit ? 'Edit your resource' : 'Post to the Resource Hub'}</h1>
      <p className="mb-7 mt-2.5 text-ink-soft">
        Sell your notes or give them away. Students see page 1 and a blurred preview of the next few.
      </p>

      <div className="max-w-[640px] rounded-slab border border-line bg-paper p-6 md:p-9">
        <div className="mb-4">
          <label className="field-label" htmlFor="title">Title</label>
          <input id="title" className="field-input" maxLength={120} value={form.title} onChange={set('title')} placeholder="e.g. DBMS handwritten notes, units 1–5" />
          <FieldError msg={errors.title} />
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="subject">Subject</label>
            <select
              id="subject"
              className="field-input"
              value={otherSubject ? OTHER : form.subject}
              onChange={(e) => {
                const other = e.target.value === OTHER
                setOtherSubject(other)
                setForm((f) => ({ ...f, subject: other ? '' : e.target.value }))
              }}
            >
              <option value="" disabled>Select a subject</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value={OTHER}>Other…</option>
            </select>
            {otherSubject && (
              <input
                aria-label="Subject name"
                className="field-input mt-2"
                maxLength={60}
                value={form.subject}
                onChange={set('subject')}
                placeholder="Type the subject name"
                autoFocus
              />
            )}
            <FieldError msg={errors.subject} />
          </div>
          <div>
            <label className="field-label" htmlFor="year">Year of study</label>
            <select id="year" className="field-input" value={form.year} onChange={set('year')}>
              {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
          </div>
        </div>

        <Segmented legend="Offer" value={form.offer_type} onChange={choose('offer_type')}
          options={[{ value: 'sale', label: 'Sell' }, { value: 'free', label: 'Free / Giveaway' }]} />

        {form.offer_type === 'sale' && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="price">Price (₹)</label>
              <input id="price" type="number" min="1" step="1" inputMode="numeric" className="field-input" value={form.price} onChange={set('price')} placeholder="e.g. 50" />
              <FieldError msg={errors.price} />
            </div>
            <div>
              <label className="field-label" htmlFor="upi">UPI ID <span className="font-normal text-ink-faint">(optional)</span></label>
              <input id="upi" className="field-input" value={form.upi_id} onChange={set('upi_id')} placeholder="name@okbank" />
              <FieldError msg={errors.upi_id} />
            </div>
          </div>
        )}

        <Segmented legend="Copy type" value={form.copy_type} onChange={choose('copy_type')}
          options={[{ value: 'soft', label: 'Soft copy' }, { value: 'hard', label: 'Hard copy' }]} />

        {soft ? (
          <>
            <Segmented legend="Delivered as" value={form.delivery} onChange={choose('delivery')}
              options={[{ value: 'pdf', label: 'PDF upload' }, { value: 'drive', label: 'Drive link' }]} />
            {form.delivery === 'drive' && (
              <div className="mb-4">
                <label className="field-label" htmlFor="drive">Drive link</label>
                <input id="drive" type="url" className="field-input" value={form.drive_url} onChange={set('drive_url')} placeholder="https://drive.google.com/…" />
                <p className="mt-1.5 text-[12.5px] text-ink-faint">Only shown to students with access. Google Drive/Docs, OneDrive, SharePoint, Dropbox or Mega.</p>
                <FieldError msg={errors.drive_url} />
              </div>
            )}
          </>
        ) : (
          <div className="mb-4">
            <label className="field-label" htmlFor="pickup">Campus pickup spot</label>
            <input id="pickup" className="field-input" maxLength={120} value={form.pickup_spot} onChange={set('pickup_spot')} placeholder="e.g. Library foyer" />
            <FieldError msg={errors.pickup_spot} />
          </div>
        )}

        <div className="mb-4">
          <label className="field-label" htmlFor="pdf">{fileLabel}</label>
          {keepsFile && !file && (
            <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-[11px] border border-line bg-[#fbfbf9] px-3.5 py-2.5 text-[13.5px]">
              <span>📄 Current file{existing.page_count ? ` · ${existing.page_count} page${existing.page_count === 1 ? '' : 's'}` : ''}</span>
              {fileRole === 'sample-optional' && (
                <button type="button" className="btn-ghost btn-sm ml-auto" onClick={() => setRemoveFile(true)}>Remove</button>
              )}
            </div>
          )}
          {file && (
            <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-[11px] border border-brand/40 bg-brand-tint px-3.5 py-2.5 text-[13.5px]">
              <span className="truncate">📄 {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" className="btn-ghost btn-sm ml-auto" onClick={() => setFile(null)}>Clear</button>
            </div>
          )}
          <div className="rounded-[14px] border-[1.5px] border-dashed border-line bg-[#fbfbf9] p-5 text-center text-[13.5px] text-ink-faint">
            <input id="pdf" type="file" accept="application/pdf,.pdf" onChange={pickFile} className="mx-auto mb-2 block" />
            {hasFile ? 'Choose a file to replace it. ' : ''}PDF only, up to {MAX_PDF_MB} MB, no password.
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-faint">{fileHint}</p>
          <FieldError msg={errors.file} />
        </div>

        <div className="mb-6">
          <label className="field-label" htmlFor="description">Description</label>
          <textarea id="description" rows={4} maxLength={DESCRIPTION_MAX} className="field-input resize-y" value={form.description} onChange={set('description')}
            placeholder="What’s covered, how it’s organised, handwritten or typed…" />
          <div className="mt-1 flex justify-between text-[12.5px]">
            <FieldError msg={errors.description} />
            <span className={`ml-auto ${form.description.length > DESCRIPTION_MAX - 30 ? 'text-coral' : 'text-ink-faint'}`}>
              {form.description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button className="btn-accent" onClick={save} disabled={saving}>
            {saving ? (isEdit ? 'Saving…' : 'Posting…') : isEdit ? 'Save changes' : 'Post resource'}
          </button>
          <button className="btn-ghost" onClick={() => navigate(isEdit ? `/resources/${id}` : '/resources')}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
