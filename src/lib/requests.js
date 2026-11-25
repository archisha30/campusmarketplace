// "Looking for" requests. The API stores what's needed and one line of details (200 characters).
// Category, budget and when it's needed go at the front of that line as plain words, so they read
// fine anywhere the details show ("Electronics · Up to ₹300 · Needed this week · Any condition"),
// and parseDetails picks them out again for the request cards.
import { CATEGORIES } from '../data/sample.js'
import { openContact } from './contact.js'

export const PRODUCT_MAX = 70
export const DETAILS_MAX = 200
export const REQUEST_CATEGORIES = [...CATEGORIES, 'Other']
export const NEEDED_BY = [
  { value: 'Needed today', label: 'Today' },
  { value: 'Needed this week', label: 'This week' },
  { value: 'No rush', label: 'No rush' },
]

const SEP = ' · '
const BUDGET = /^Up to ₹([\d,]+)$/

const oneLine = (s = '') => s.replace(/\s+/g, ' ').trim()

export function buildDetails({ category, budget, neededBy, note }) {
  return [
    category,
    Number(budget) > 0 ? `Up to ₹${Number(budget).toLocaleString('en-IN')}` : '',
    neededBy,
    oneLine(note),
  ].filter(Boolean).join(SEP)
}

// How many characters are left for the note beside the other answers.
export function noteMax(answers) {
  const front = buildDetails({ ...answers, note: '' })
  return DETAILS_MAX - (front ? front.length + SEP.length : 0)
}

// Requests posted before these fields existed come back as just a note.
export function parseDetails(text) {
  const parts = (text || '').split(SEP)
  const out = { category: '', budget: '', neededBy: '', note: '' }
  if (REQUEST_CATEGORIES.includes(parts[0])) out.category = parts.shift()
  if (BUDGET.test(parts[0] || '')) out.budget = parts.shift().match(BUDGET)[1]
  if (NEEDED_BY.some((n) => n.value === parts[0])) out.neededBy = parts.shift()
  out.note = parts.join(SEP)
  return out
}

// Opens WhatsApp (or email) to the student who asked. Their number isn't in the feed; it's
// fetched only when this is tapped.
export function replyToRequest(r) {
  return openContact({
    targetType: 'request',
    targetId: r.id,
    channel: r.requester.has_phone ? 'whatsapp' : 'email',
    subject: `CampusMarket — ${r.product}`,
    message: `Hi ${r.requester.name}! I saw your request for "${r.product}" on CampusMarket. I might have it.`,
  })
}
