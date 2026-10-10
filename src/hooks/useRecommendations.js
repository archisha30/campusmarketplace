import { useMemo } from 'react'
import { listingsApi, resourcesApi } from '../services/api.js'
import { useApi } from './useApi.js'
import { affinity } from '../lib/recommendations.js'
import { useAuth } from './useAuth.jsx'
import { studyYear } from '../lib/resources.js'

// Listing picks. Two callers (Marketplace, ListingDetail). Reads the client-side
// affinity signal once per mount so both consumers score against the same snapshot.
// strict: only listings in the student's chosen interests (no filler from other categories).
export function useRecommendations({ excludeId, strict = false } = {}) {
  const { user } = useAuth()
  const { hasHistory, scores: categoryScores } = useMemo(
    () => affinity(user, 'listing', user?.interests || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.interests]
  )

  const { data, loading } = useApi(
    () => listingsApi.recommended({
      excludeId,
      campusId: user?.campus_id,
      categoryScores,
      onlyCategories: strict ? user?.interests || [] : [],
    }),
    [excludeId, strict, user?.id, user?.campus_id, hasHistory, user?.interests]
  )

  return {
    items: data?.items || [],
    personalized: Boolean(data?.personalized),
    loading,
  }
}

// Resource Hub picks: subject affinity from opened resources, plus the student's year of study.
export function useResourceRecommendations({ excludeId } = {}) {
  const { user } = useAuth()
  const year = studyYear(user?.year)
  const { hasHistory, scores: subjectScores } = useMemo(
    () => affinity(user, 'resource'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id]
  )

  const { data, loading } = useApi(
    () => resourcesApi.recommended({ excludeId, year, subjectScores }),
    [excludeId, user?.id, year, hasHistory]
  )

  return {
    items: data?.items || [],
    personalized: Boolean(data?.personalized),
    year,
    loading,
  }
}
