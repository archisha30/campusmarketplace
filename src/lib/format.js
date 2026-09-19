export function formatPrice(price) {
  if (price === 0) return 'Free'
  return `₹${Number(price).toLocaleString('en-IN')}`
}

export function contactLink(listing, { phone = '910000000000' } = {}) {
  const text = `Hi! I'm interested in your ${listing.title} listed on CampusMarket. Is it still available?`
  return {
    whatsapp: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
    email: `mailto:?subject=${encodeURIComponent(`CampusMarket — ${listing.title}`)}&body=${encodeURIComponent(text)}`,
  }
}

export function titleCase(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
