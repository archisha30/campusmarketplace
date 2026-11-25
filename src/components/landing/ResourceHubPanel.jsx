import { Link } from 'react-router-dom'
import Reveal from '../Reveal.jsx'

const Line = ({ w, className = 'mt-2 bg-line-soft' }) => <div className={`h-2 rounded ${className}`} style={{ width: w }} />

// The page on the right is a drawing: resources are only shown to logged-in students.
export default function ResourceHubPanel({ link }) {
  return (
    <section id="hub" className="wrap scroll-mt-24 pt-section">
      <Reveal className="panel flex flex-wrap items-center gap-12 bg-ink p-8 text-white md:p-12">
        <div className="min-w-0 flex-[1_1_300px]">
          <p className="eyebrow !text-sun">Resource Hub</p>
          <h2 className="my-4 text-[32px] leading-[1.1] md:text-[40px]">Notes from fellow students, sorted by subject.</h2>
          <p className="mb-8 text-[17px] leading-relaxed text-[#C9C9DA]">Preview the first page, then grab the full PDF or Drive link.</p>
          <Link {...link} className="btn-onblue">Explore Resource Hub</Link>
        </div>
        <div aria-hidden className="relative h-[280px] min-w-0 flex-[1_1_240px]" style={{ perspective: 1200 }}>
          <div className="absolute bottom-8 left-12 right-12 top-0 rounded-control bg-[#2C2C38] md:left-16 md:right-16" style={{ transform: 'rotateY(-14deg) translateX(40px) translateZ(-80px)' }} />
          <div className="sheet absolute bottom-2 left-4 right-8 top-6 rounded-control bg-white p-6 md:left-10 md:right-10">
            <Line w="58%" className="h-4 bg-line-strong" />
            <Line w="38%" className="mt-3 bg-line-soft" />
            <Line w="90%" className="mt-7 bg-line-soft" />
            <Line w="76%" />
            <Line w="84%" />
            <div style={{ filter: 'blur(4px)' }}>
              <Line w="86%" className="mt-6 bg-line-strong" />
              <Line w="64%" className="mt-2 bg-line-strong" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
