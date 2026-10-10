export function formatPrice(price) {
  if (price === 0) return 'Free'
  return `₹${Number(price).toLocaleString('en-IN')}`
}

// "Contact Seller" links. WhatsApp goes to the seller's own number (collected at onboarding);
// it's null for older accounts without one, so the page falls back to email only.
export function contactLink(listing) {
  const phone = listing.seller?.phone
  const text = `Hi! I'm interested in your ${listing.title} listed on CampusMarket. Is it still available?`
  return {
    whatsapp: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null,
    // Opens Gmail's compose window in a new tab, addressed to the seller.
    email: `https://mail.google.com/mail/?${new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: listing.seller?.email || '',
      su: `CampusMarket — ${listing.title}`,
      body: `${text}\n\nThanks!`,
    })}`,
  }
}

export function titleCase(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// First letter of a user's name (or email) for avatar circles.
export function initial(user) {
  return (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()
}

// "919876543210" -> "+91 98765 43210" for display.
export function formatPhone(phone) {
  if (!phone) return ''
  const m = String(phone).match(/^91(\d{5})(\d{5})$/)
  return m ? `+91 ${m[1]} ${m[2]}` : phone
}

// "2026-10-04T09:00:00" -> "5m ago" / "3h ago" / "2d ago" / "4 Oct".
export function timeAgo(iso) {
  // The API sends naive UTC timestamps; treat them as UTC.
  const t = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// "2026-10-09" -> "9 Oct 2026". Date-only values from the API (no time zone).
export function formatDay(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Today as "YYYY-MM-DD" in the student's own time zone (for <input type="date" min>).
export function todayISO() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

// F&B listings past their expiry date. The API also sends is_expired; this covers mock data.
export function isExpired(listing) {
  if (listing?.is_expired != null) return listing.is_expired
  return Boolean(listing?.expiry_date && String(listing.expiry_date).slice(0, 10) < todayISO())
}

// "🔥 Hot" / "❄️ Cold" for F&B listings, else ''.
export function foodTempLabel(listing) {
  if (listing?.food_temp === 'hot') return '🔥 Hot'
  if (listing?.food_temp === 'cold') return '❄️ Cold'
  return ''
}

// "+91 98765 43210" / "098765-43210" / "9876543210" -> "9876543210"; null if it isn't a
// valid Indian mobile number. Same rule as normalize_phone on the backend.
export function cleanIndianMobile(value = '') {
  const digits = String(value).replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}
