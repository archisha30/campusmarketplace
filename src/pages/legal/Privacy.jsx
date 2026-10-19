import { Link } from 'react-router-dom'
import LegalPage from './LegalPage.jsx'

const CONTACT = 'archishap30@gmail.com'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="19 October 2026">
      <p>
        CampusMarket is a marketplace for verified students of Medhavi Skills University to buy, sell, rent and share
        things, and to share study material. This page explains what we collect, why, and what you can do about it.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your college email, name, college, course, year of study, buyer/seller choice and interests.</li>
          <li><strong>WhatsApp number:</strong> so students can contact you about your listings.</li>
          <li><strong>Profile picture</strong>, if you add one.</li>
          <li><strong>What you post:</strong> listings, photos, resources and PDFs, “Looking for” requests and reports.</li>
          <li><strong>Sign-in:</strong> if you use “Continue with Google”, Google tells us your email, name and that your email is verified. We never see your Google password. If you use a password with us, we only store a scrambled (hashed) version of it.</li>
          <li><strong>Activity used for recommendations:</strong> which listing categories and resource subjects you open.</li>
          <li><strong>Basic usage statistics</strong> through Google Analytics (pages visited, not your personal details).</li>
        </ul>
      </section>

      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To verify that you're a student of the college and keep the marketplace safe.</li>
          <li>To show your listings and resources, and let buyers contact you.</li>
          <li>To send you login and verification codes by email.</li>
          <li>To notify you about access requests, messages and reports on your items.</li>
          <li>To recommend things you're likely to want.</li>
        </ul>
        <p className="mt-2">We don't sell your data and we don't show ads.</p>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li><strong>Other verified students</strong> see your name, college, profile picture, and what you post. Nothing is visible to people who aren't logged in.</li>
          <li><strong>Your phone number and email</strong> are never shown in lists. A student only gets them when they tap “Contact Seller” on one of your items, and that is limited and logged to prevent misuse.</li>
          <li><strong>Paid PDFs</strong> are only available to the owner, admins, and students the owner approves.</li>
          <li><strong>Reports</strong> are anonymous to the person reported; admins can see who reported.</li>
          <li><strong>CampusMarket admins</strong> can see account details to keep the platform safe.</li>
        </ul>
      </section>

      <section>
        <h2>Where it's stored</h2>
        <p>
          Your data is stored with <strong>Supabase</strong> (database and files). The app runs on <strong>Vercel</strong> and
          <strong> Render</strong>, login emails are sent with <strong>Brevo</strong>, and we use <strong>Google</strong> for
          “Continue with Google” and Analytics. These services only process data to run CampusMarket. Connections are
          encrypted (HTTPS), and you stay logged in with a secure cookie that other websites can't read.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Edit your profile, phone number and picture anytime in <Link to="/profile" className="font-semibold text-brand">Profile</Link>.</li>
          <li>Delete your listings and resources from your dashboard.</li>
          <li>To delete your account and everything linked to it, email us at <a href={`mailto:${CONTACT}`} className="font-semibold text-brand">{CONTACT}</a> from your college email.</li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about your data? Email <a href={`mailto:${CONTACT}`} className="font-semibold text-brand">{CONTACT}</a>.</p>
      </section>
    </LegalPage>
  )
}
