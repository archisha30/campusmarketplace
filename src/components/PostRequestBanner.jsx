import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PostRequestModal from './PostRequestModal.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

// "Looking for something? Post a request" strip. Shown on the landing page and at the
// bottom of the Marketplace and Resource Hub. Logged-out visitors are sent to log in first.
export default function PostRequestBanner({ className = '' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [requesting, setRequesting] = useState(false)

  return (
    <section className={className}>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-slab bg-[#141721] p-9">
        <div>
          <h3 className="mb-1.5 text-[20px] font-semibold text-white">Looking for something?</h3>
          <p className="text-sm text-[#B7BAC4]">"Need a Casio fx-991CW for tomorrow." Post a request and sellers will reach out.</p>
        </div>
        <button
          className="btn bg-white text-ink hover:shadow-lg"
          onClick={() => (user ? setRequesting(true) : navigate('/login', { state: { from: pathname } }))}
        >
          Post a Request
        </button>
        <PostRequestModal open={requesting} onClose={() => setRequesting(false)} />
      </div>
    </section>
  )
}
