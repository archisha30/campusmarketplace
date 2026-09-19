import EmptyState from '../components/EmptyState.jsx'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[760px] px-6 py-16">
      <EmptyState
        emoji="🧭"
        title="That page doesn't exist"
        body="The link may be out of date. Head back to the marketplace and start from there."
        actionLabel="Go to Marketplace"
        actionTo="/marketplace"
      />
    </div>
  )
}
