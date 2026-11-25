import { Link } from 'react-router-dom'
import Reveal from './Reveal.jsx'

// "Looking for something? Post a request" strip. Full size on the landing page; `compact` at the
// bottom of the Marketplace and Resource Hub. Logged-out visitors log in first, then land on the form.
export default function PostRequestBanner({ className = '', compact = false }) {
  return (
    <section className={className}>
      <Reveal className={`panel flex flex-wrap items-center justify-between bg-sun ${compact ? 'gap-x-6 gap-y-4 px-5 py-4 md:px-6' : 'gap-6 p-8 md:p-12'}`}>
        <div className={`min-w-0 ${compact ? 'flex-[1_1_220px]' : 'flex-[1_1_260px]'}`}>
          <h2 className={compact ? 'text-lg leading-tight md:text-xl' : 'text-[32px] leading-[1.1] md:text-[40px]'}>Looking for something?</h2>
          <p className={`text-[#3A3A12] ${compact ? 'mt-1 text-sm' : 'mt-2 text-lg'}`}>
            Tell students on campus what you need, and whoever has it can message you.
          </p>
        </div>
        <Link to="/requests/new" className={`btn-primary ${compact ? 'btn-sm' : ''}`}>Post a request</Link>
      </Reveal>
    </section>
  )
}
