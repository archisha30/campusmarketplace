import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export function LogoMark({ size = 32 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 64 64" className="flex-none">
      <rect width="64" height="64" rx="12" fill="#2F4BFF" />
      <path d="M33.7 14.7a4 4 0 0 0-2.8-1.2H18a4 4 0 0 0-4 4v12.9a4 4 0 0 0 1.2 2.8l15.6 15.6a4.4 4.4 0 0 0 6.2 0l11.8-11.8a4.4 4.4 0 0 0 0-6.2z" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="23.5" cy="23.5" r="4.5" fill="#FFD447" />
    </svg>
  )
}

export default function Logo() {
  const { isVerified } = useAuth()
  // Logged-in students don't use the landing page, so the logo takes them to the marketplace.
  return (
    <Link to={isVerified ? '/marketplace' : '/'} aria-label="Campus Market home" className="hd flex flex-none items-center gap-2 whitespace-nowrap text-[18px] sm:text-xl lg:text-2xl">
      <LogoMark />
      {/* Just the icon on the very smallest phones, where the name would push the menu off screen. */}
      <span className="max-[355px]:hidden">Campus Market</span>
    </Link>
  )
}
