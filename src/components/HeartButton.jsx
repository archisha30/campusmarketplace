import Icon from './Icon.jsx'

// Just the look of the heart, for the home page's teaser cards: it saves nothing, and a tap on it
// opens the listing like the rest of the card.
export function HeartProp() {
  return (
    <span aria-hidden className="btn-icon absolute right-2 top-2">
      <Icon name="heart" size={20} />
    </span>
  )
}

// The wishlist heart in the corner of a card. The card is a link, so the tap must not open it.
export default function HeartButton({ saved, onToggle, compact = false }) {
  return (
    <button
      type="button"
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className={`btn-icon absolute right-2 top-2 z-10 ${compact ? 'h-9 w-9' : ''} ${saved ? 'text-coral' : ''}`}
    >
      <Icon name="heart" size={compact ? 18 : 20} filled={saved} />
    </button>
  )
}
