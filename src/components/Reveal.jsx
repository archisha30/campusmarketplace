import { useReveal } from '../hooks/useReveal.js'

// Wraps something that fades and slides in as it scrolls into view (see useReveal).
// `i` is its place in a row: cards in a row of four start 0.12s apart.
export default function Reveal({ as: Tag = 'div', i = 0, className = '', style, children, ...rest }) {
  const reveal = useReveal()
  return (
    <Tag ref={reveal.ref} className={`${className} ${reveal.className}`} style={{ '--rd': `${(i % 4) * 0.12}s`, ...style }} {...rest}>
      {children}
    </Tag>
  )
}
