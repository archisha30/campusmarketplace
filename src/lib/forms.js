// After a submit with problems: scroll the first one into view (below the sticky navbar)
// and put the cursor in it, so nobody is left wondering why nothing happened.
// Each field's wrapper carries data-field="<error key>"; `order` is the on-page order.
export function revealFirstError(errors, order) {
  const key = order.find((k) => errors[k])
  if (!key) return
  const box = document.querySelector(`[data-field="${key}"]`)
  if (!box) return
  box.scrollIntoView({ behavior: 'smooth', block: 'center' })
  box.querySelector('input:not([type=hidden]), select, textarea, button')?.focus({ preventScroll: true })
}
