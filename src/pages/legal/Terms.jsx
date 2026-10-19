import { Link } from 'react-router-dom'
import LegalPage from './LegalPage.jsx'

const CONTACT = 'archishap30@gmail.com'

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="19 October 2026">
      <p>
        By using CampusMarket you agree to these terms. They're short, and written for students. Please read them.
      </p>

      <section>
        <h2>Who can use CampusMarket</h2>
        <ul>
          <li>Current students of Medhavi Skills University with a college email.</li>
          <li>One account per person. Keep your login private; you're responsible for what happens on your account.</li>
        </ul>
      </section>

      <section>
        <h2>Buying and selling</h2>
        <ul>
          <li>Deals happen <strong>directly between students</strong>. CampusMarket isn't part of the sale and doesn't handle payments.</li>
          <li>Meet in a safe, public place on campus, inspect items before paying, and pay by cash or UPI.</li>
          <li>Describe items honestly, with real photos and a fair price. Mark items Reserved or Sold when that changes.</li>
          <li>Food (F&amp;B) must be safe, clearly labelled hot or cold, and within its expiry date.</li>
        </ul>
      </section>

      <section>
        <h2>Study resources</h2>
        <ul>
          <li>Only share material you made or have the right to share. Don't upload copyrighted books or paid course content.</li>
          <li>Buyers who get access to a paid resource may use it for their own study, not resell or repost it.</li>
        </ul>
      </section>

      <section>
        <h2>Not allowed</h2>
        <ul>
          <li>Illegal, stolen, dangerous or prohibited items (including alcohol, drugs, weapons, and exam papers obtained unfairly).</li>
          <li>Scams, fake listings, spam, harassment, or collecting other students' contact details.</li>
          <li>Trying to break, overload or get around the app's security.</li>
        </ul>
        <p className="mt-2">
          Use <strong>Report</strong> on any listing or resource that breaks these rules. Admins may remove content and
          suspend or delete accounts that misuse CampusMarket.
        </p>
      </section>

      <section>
        <h2>Our responsibility</h2>
        <p>
          CampusMarket is a student project provided “as is”. We do our best to keep it safe and running, but we can't
          guarantee items, payments or the behaviour of other students, and we aren't liable for losses from deals made
          through the app. Use your judgement.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; the date above shows the latest version. Your data is handled as described in our{' '}
          <Link to="/privacy" className="font-semibold text-brand">Privacy Policy</Link>. Questions? Email{' '}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-brand">{CONTACT}</a>.
        </p>
      </section>
    </LegalPage>
  )
}
