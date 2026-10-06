// Shared Resource Hub constants and helpers. Mirrors campusmarket-backend/app/schemas/resource.py.

export const YEARS = [
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '4', label: '4th year' },
  { value: 'any', label: 'Any year' },
]

// Standard subjects, always offered in the filter and the form. Mirrors SUBJECTS in
// campusmarket-backend/app/schemas/resource.py. Other subjects can still be typed.
export const SUBJECTS = [
  'Maths for AI/ML',
  'GenAI',
  'GoLang',
  'Data Science',
  'Full Stack Web Development',
  'DBMS',
  'Frontend Development',
  'DSA',
  'Machine Learning',
]

// "dsa" -> "DSA"; anything not in the list is kept as typed (whitespace tidied).
export function canonicalSubject(value = '') {
  const clean = value.replace(/\s+/g, ' ').trim()
  return SUBJECTS.find((s) => s.toLowerCase() === clean.toLowerCase()) || clean
}

export const DESCRIPTION_MAX = 500
export const NOTE_MAX = 200
export const MAX_PDF_MB = 15
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024

// Subdomains count, e.g. contoso.sharepoint.com or www.dropbox.com.
export const DRIVE_HOSTS = [
  'drive.google.com', 'docs.google.com', 'onedrive.live.com', '1drv.ms',
  'sharepoint.com', 'dropbox.com', 'mega.nz', 'mega.io',
]

// Profile "Year" is free text ("2nd Year", "3rd Semester"); turn it into "1".."4" or null.
export function studyYear(text = '') {
  const m = String(text).match(/\d/)
  if (!m) return null
  let n = Number(m[0])
  if (/sem/i.test(text)) n = Math.ceil(n / 2)
  return n >= 1 && n <= 4 ? String(n) : null
}

export function yearLabel(year) {
  return YEARS.find((y) => y.value === String(year))?.label || 'Any year'
}

export function isAllowedDriveUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  return DRIVE_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))
}

// Cheap client-side PDF check before upload. The server re-validates everything.
export async function checkPdfFile(file) {
  if (!file) return null
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!looksPdf) return 'Only PDF files can be uploaded.'
  if (file.size > MAX_PDF_BYTES) return `PDF must be under ${MAX_PDF_MB} MB.`
  try {
    const head = await file.slice(0, 4).text()
    if (head !== '%PDF') return "That file isn't a valid PDF."
  } catch {
    // Older browsers without Blob.text(); let the server decide.
  }
  return null
}

// upi:// deep link that opens the buyer's UPI app with the amount filled in.
export function upiLink({ upiId, name, amount, note }) {
  const params = new URLSearchParams({ pa: upiId, cu: 'INR' })
  if (name) params.set('pn', name)
  if (amount) params.set('am', String(amount))
  if (note) params.set('tn', note.slice(0, 50))
  return `upi://pay?${params}`
}

export function deliveryLabel(r) {
  if (r.copy_type === 'hard') return 'Hard copy'
  return r.delivery === 'drive' ? 'Drive link' : 'PDF'
}
