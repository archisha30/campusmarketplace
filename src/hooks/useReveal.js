import { useLayoutEffect, useRef, useState } from 'react'
import { reducedMotion } from '../lib/motion.js'

// Fade-and-slide-in as an element scrolls into view, once. Returns the ref to put on it and the
// class to add. The element is only hidden after this runs (and only where IntersectionObserver
// exists and motion is allowed), so without JavaScript everything stays visible.
export function useReveal() {
  const ref = useRef(null)
  const [state, setState] = useState('idle') // idle -> hidden -> shown

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined' || reducedMotion()) return
    setState('hidden') // before the first paint, so it never flashes
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        setState('shown')
        io.disconnect()
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, className: state === 'hidden' ? 'reveal reveal-hidden' : state === 'shown' ? 'reveal' : '' }
}
