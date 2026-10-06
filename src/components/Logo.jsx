import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Logo() {
  const { isVerified } = useAuth()
  // Logged-in students don't use the landing page, so the logo takes them to the marketplace.
  return (
    <Link to={isVerified ? '/marketplace' : '/'} className="flex items-center gap-2.5 font-display text-xl font-bold">
      <span className="relative h-[30px] w-[30px] flex-none rounded-[9px] bg-brand">
        <span className="absolute left-[9px] top-[9px] h-3 w-3 rotate-12 rounded-[3px] bg-sun" />
      </span>
      CampusMarket
    </Link>
  )
}
