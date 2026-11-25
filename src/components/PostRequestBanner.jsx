import { Link } from 'react-router-dom'
import Reveal from './Reveal.jsx'

// "Looking for something? Post a request" strip. Shown on the landing page and at the bottom of
// the Marketplace and Resource Hub. Logged-out visitors log in first, then land on the form.
export default function PostRequestBanner({ className = '' }) {
  return (
    <section className={className}>
      <Reveal className="panel flex flex-wrap items-center justify-between gap-6 bg-sun p-8 md:p-12">
        <div className="min-w-0 flex-[1_1_260px]">
          <h2 className="text-[32px] leading-[1.1] md:text-[40px]">Looking for something?</h2>
          <p className="mt-2 text-lg text-[#3A3A12]">Tell students on campus what you need, and whoever has it can message you.</p>
        </div>
        <Link to="/requests/new" className="btn-primary">Post a request</Link>
      </Reveal>
    </section>
  )
}
