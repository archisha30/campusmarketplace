const STEPS = [
  { kicker: 'Find', title: 'Search what you need', body: 'Textbooks, electronics, dorm essentials, lab equipment, and more.' },
  { kicker: 'Connect', title: 'Message the seller', body: 'Contact the verified student directly through WhatsApp or email.' },
  { kicker: 'Meet & Exchange', title: 'Trade on campus', body: 'Meet at a safe campus location, inspect the item, and pay via cash or UPI.' },
]

// The three steps, shown on the landing page and on /how-it-works.
export default function HowItWorksSteps({ heading: Heading = 'h3' }) {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {STEPS.map((s) => (
        <div key={s.kicker}>
          <div className="relative mb-3.5 h-0.5 bg-line">
            <span className="absolute -top-1 left-0 h-2.5 w-2.5 rounded-full bg-brand" />
          </div>
          <p className="mb-3 font-display text-[13px] font-semibold text-brand">{s.kicker}</p>
          <Heading className="mb-2 text-[19px] font-semibold">{s.title}</Heading>
          <p className="text-[14.5px] text-ink-soft">{s.body}</p>
        </div>
      ))}
    </div>
  )
}
