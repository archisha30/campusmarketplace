import { Link } from 'react-router-dom'
import NotificationsPanel from '../components/NotificationsPanel.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

// Everyone's notifications. Buyers land here from the navbar bell (answers to their access
// requests); sellers have the same list on their dashboard, next to Looking For.
export default function Notifications() {
  const { isSeller } = useAuth()
  return (
    <div className="mx-auto max-w-[820px] px-6 py-9">
      <h1 className="mb-6 text-[30px] font-bold">Notifications</h1>
      <NotificationsPanel
        previewCount={Infinity}
        blurb={isSeller
          ? 'Answers to your access requests, students reaching out, and updates about your items'
          : 'Answers to your access requests on the Resource Hub, and updates from the CampusMarket team'}
        empty="Nothing yet. When a seller approves or declines your access request, you'll see it here."
      />
      {isSeller && (
        <p className="text-[13.5px] text-ink-soft">
          Looking For requests from buyers are on your <Link to="/dashboard#requests" className="font-semibold text-brand hover:underline">Seller Dashboard</Link>.
        </p>
      )}
    </div>
  )
}
