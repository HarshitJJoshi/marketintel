import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

const C = { bg: "#0f1112", border: "#2a2d2f", text: "#ececec", textMuted: "#9ba1a6" }
const UPDATED = "September 24, 2026"

function LegalPage({ title, sections }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', color: C.text, fontSize: 15, fontWeight: 750, letterSpacing: '-0.3px' }}>
          MarketIntel
        </Link>
      </div>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>{title}</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 32 }}>Last updated {UPDATED}</p>
        {sections.map(([heading, body]) => (
          <section key={heading} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{heading}</h2>
            <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>{body}</p>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  )
}

const TERMS = [
  ["Acceptance", "By creating an account or using MarketIntel (the \"Service\"), you agree to these Terms. If you do not agree, do not use the Service."],
  ["Not financial advice", "MarketIntel provides market data, scores and signals for informational and educational purposes only. Nothing on the Service is investment, financial, legal or tax advice, or a recommendation to buy, sell or hold any security. MarketIntel is not a registered broker-dealer or investment adviser. You are solely responsible for your investment decisions and should consult a qualified professional before acting."],
  ["Data provided as-is", "Data is gathered from third-party and public sources and may be delayed, incomplete or inaccurate. The Service is provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including accuracy, timeliness, fitness for a particular purpose or uninterrupted availability. Past performance does not guarantee future results."],
  ["Accounts", "You are responsible for keeping your login credentials secure and for all activity under your account. You must provide accurate information and be at least 18 years old."],
  ["Subscriptions and billing", "Pro subscriptions are billed monthly through our payment provider, Lemon Squeezy, which acts as merchant of record. Subscriptions renew automatically until cancelled. You can cancel at any time and keep Pro access until the end of the current billing period. Except where required by law, payments are non-refundable. We may change prices with advance notice."],
  ["Acceptable use", "You may not scrape, resell or redistribute data from the Service, attempt to bypass access controls, interfere with the Service's operation, or use it for any unlawful purpose. We may suspend or terminate accounts that violate these Terms."],
  ["Limitation of liability", "To the maximum extent permitted by law, MarketIntel and its operators are not liable for any trading or investment losses, or for any indirect, incidental, special or consequential damages arising from your use of the Service. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim."],
  ["Changes", "We may update these Terms from time to time. Continued use of the Service after changes take effect means you accept the updated Terms."],
  ["Contact", "Questions about these Terms? Email support@marketintelhq.app."],
]

const PRIVACY = [
  ["What we collect", "When you sign up with email and password or with Google, we receive your email address and basic profile information (such as your name and profile picture from Google). We store your account, subscription plan and watchlist. Our servers may also log standard technical data such as IP address and browser type."],
  ["How we use it", "We use your information to create and secure your account, provide the Service, manage your subscription and respond to support requests. We do not sell your personal information and do not use it for third-party advertising."],
  ["Google sign-in", "If you sign in with Google, we only request your basic profile and email address. We do not access your Gmail, contacts, Drive or any other Google data. Our use of information received from Google APIs follows the Google API Services User Data Policy, including its Limited Use requirements."],
  ["Service providers", "We rely on Supabase for authentication and database hosting, Vercel and Railway for hosting, and Lemon Squeezy for payment processing. Lemon Squeezy handles your payment details directly and we never see or store your card number. These providers process data only as needed to operate the Service."],
  ["Cookies and local storage", "We use browser storage to keep you signed in. We do not use advertising or cross-site tracking cookies."],
  ["Retention and deletion", "We keep your data while your account is active. You can ask us to delete your account and associated data at any time, and we will do so except where we are required to keep records such as billing history."],
  ["Security", "Data is transmitted over HTTPS and access to our database is restricted. No system is perfectly secure, but we take reasonable measures to protect your information."],
  ["Your rights", "Depending on where you live, you may have the right to access, correct, export or delete your personal data. Email support@marketintelhq.app to make a request."],
  ["Changes", "We may update this policy from time to time and will revise the date above when we do."],
  ["Contact", "Privacy questions or requests: support@marketintelhq.app."],
]

export const Terms = () => <LegalPage title="Terms of Service" sections={TERMS} />
export const Privacy = () => <LegalPage title="Privacy Policy" sections={PRIVACY} />
