import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { draftsApi } from '../services/api.js'

// Save / resume a form as a draft (Seller Dashboard → Drafts). The draft id lives in
// the URL (?draft=12), so saving again updates the same draft and a refresh keeps it.
// `onLoad(data)` fills the form when opening an existing draft (and gets {} when the page
// leaves the draft for a blank form); `onMissing(err)` runs if the draft is gone.
export function useDraft(kind, { enabled = true, onLoad, onMissing } = {}) {
  const [params, setParams] = useSearchParams()
  const draftId = enabled ? params.get('draft') : null
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId))
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  // The id of a draft this page just created: its data is already in the form.
  const created = useRef(null)

  const previous = useRef(draftId)

  useEffect(() => {
    const left = previous.current && !draftId // e.g. clicked "Sell" in the navbar while on a draft
    previous.current = draftId
    if (left) {
      created.current = null
      setSavedAt(null)
      onLoad?.({})
      return
    }
    if (!draftId || draftId === created.current) return
    let cancelled = false
    setLoadingDraft(true)
    draftsApi
      .get(draftId)
      .then((d) => {
        if (cancelled) return
        if (d.kind !== kind) throw new Error('Draft not found')
        onLoad?.(d.data || {})
        setSavedAt(d.updated_at)
      })
      .catch((err) => {
        if (cancelled) return
        onMissing?.(err)
        setParams({}, { replace: true })
      })
      .finally(() => { if (!cancelled) setLoadingDraft(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, kind])

  const saveDraft = useCallback(async (data) => {
    setSavingDraft(true)
    try {
      const d = draftId ? await draftsApi.update(draftId, kind, data) : await draftsApi.create(kind, data)
      setSavedAt(d.updated_at)
      if (!draftId) {
        created.current = String(d.id)
        setParams({ draft: String(d.id) }, { replace: true })
      }
      return d
    } finally {
      setSavingDraft(false)
    }
  }, [draftId, kind, setParams])

  // After publishing, the draft has done its job.
  const discardDraft = useCallback(() => {
    if (draftId) draftsApi.remove(draftId).catch(() => {})
  }, [draftId])

  return { draftId, loadingDraft, savingDraft, savedAt, saveDraft, discardDraft }
}
