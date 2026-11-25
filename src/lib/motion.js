// True when the student's device asks for no motion (Settings → Reduce motion).
export function reducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

// For scrollIntoView / scrollBy, which ignore the CSS scroll-behavior when given 'smooth'.
export const scrollMotion = () => (reducedMotion() ? 'auto' : 'smooth')
