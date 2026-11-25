// Wraps something that appears as it scrolls into view. `i` is its place in a row (for the stagger).
export default function Reveal({ as: Tag = 'div', i = 0, className = '', children, ...rest }) {
  return <Tag className={className} data-i={i} {...rest}>{children}</Tag>
}
