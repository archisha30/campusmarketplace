export function formatPrice(price) {
  if (price === 0) return 'Free'
  return `₹${Number(price).toLocaleString('en-IN')}`
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

// When a listing went up: "Listed today" / "Listed yesterday" / "Listed Mon, 20 Oct"
// (with the year once it's from an earlier year). Works with naive-UTC API timestamps.
export function listedOn(iso) {
  if (!iso) return ''
  const s = String(iso)
  const t = new Date(s.length <= 10 ? `${s}T00:00:00` : /[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`)
  const today = new Date()
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(today) - startOf(t)) / 86400000)
  if (days <= 0) return 'Listed today'
  if (days === 1) return 'Listed yesterday'
  const opts = { weekday: 'short', day: 'numeric', month: 'short' }
  if (t.getFullYear() !== today.getFullYear()) opts.year = 'numeric'
  return `Listed ${t.toLocaleDateString('en-IN', opts)}`
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
