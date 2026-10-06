export function formatPrice(price) {
  if (price === 0) return 'Free'
  return `₹${Number(price).toLocaleString('en-IN')}`
}

// Fallback WhatsApp number for "Contact Seller" when the seller hasn't added one,
// in international format without "+" (91 = India).
const SELLER_WHATSAPP = '917008699207'

export function contactLink(listing, { phone = listing.seller?.phone || SELLER_WHATSAPP } = {}) {
  const text = `Hi! I'm interested in your ${listing.title} listed on CampusMarket. Is it still available?`
  return {
    whatsapp: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
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
