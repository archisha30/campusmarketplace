// Google Analytics 4. Off unless VITE_GA_MEASUREMENT_ID is set (e.g. only on Vercel),
// so local development doesn't pollute the stats.
//
// This is a single-page app: the browser never reloads between pages, so GA's automatic
// page_view only fires once. We turn that off and send one page_view per route change
// (see components/AnalyticsTracker.jsx) instead.
//
// Never send personal data here (emails, names, phone numbers, free text). Page paths,
// categories and subjects are fine.

const ID = import.meta.env.VITE_GA_MEASUREMENT_ID
let ready = false

export function initAnalytics() {
  if (!ID || ready || typeof window === 'undefined') return
  ready = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments) // gtag expects the arguments object itself
  }
  window.gtag('js', new Date())
  window.gtag('config', ID, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`
  document.head.appendChild(script)
}

export function trackPageView(path) {
  if (!ready) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: document.title,
  })
}

export function trackEvent(name, params = {}) {
  if (!ready) return
  window.gtag('event', name, params)
}
