import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PostRequestModal from './PostRequestModal.jsx'
import Reveal from './Reveal.jsx'
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
      <Reveal className="panel flex flex-wrap items-center justify-between gap-6 bg-sun p-8 md:p-12">
        <div className="min-w-0 flex-[1_1_260px]">
          <h2 className="text-[32px] leading-[1.1] md:text-[40px]">Looking for something?</h2>
          <p className="mt-2 text-lg text-[#3A3A12]">Tell students on campus what you need, and whoever has it can message you.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => (user ? setRequesting(true) : navigate('/login', { state: { from: pathname } }))}
        >
          Post a request
        </button>
      </Reveal>
      {/* Outside the panel: a moving parent would pin the modal to itself instead of the screen. */}
      <PostRequestModal open={requesting} onClose={() => setRequesting(false)} />
    </section>
  )
}
