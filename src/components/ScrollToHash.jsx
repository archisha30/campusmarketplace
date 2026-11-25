import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollMotion } from '../lib/motion.js'

// React Router keeps the scroll position when the page changes and doesn't scroll to #anchors.
export default function ScrollToHash() {
  const { pathname, hash } = useLocation()
  const navigation = useNavigationType()

  // A new page opens at the top ('instant': no sliding up through the old page). Back and Forward
  // (POP) are left to the browser, and links to a #section are handled below.
  useLayoutEffect(() => {
    if (!hash && navigation !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' })
    // Only when the page itself changes, not its filters or page number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Sections like /dashboard#notifications render after their data loads, so keep looking for
  // the target briefly.
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    let tries = 0
    const t = setInterval(() => {
      const el = document.getElementById(id)
      if (el || ++tries > 30) {
        clearInterval(t)
        el?.scrollIntoView({ behavior: scrollMotion(), block: 'start' })
      }
    }, 100)
    return () => clearInterval(t)
  }, [pathname, hash])

  return null
}
