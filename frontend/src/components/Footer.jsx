import { Link } from 'react-router-dom'

export const DISCLAIMER = "MarketIntel is for informational purposes only and does not constitute financial advice. Past performance does not guarantee future results. Always do your own research before making investment decisions."

const link = { color: '#9ba1a6', textDecoration: 'none' }

export default function Footer({ children }) {
  return (
    <footer style={{
      textAlign: 'center', fontSize: 11, color: '#5f6568', padding: '2rem 1.5rem',
      borderTop: '1px solid #2a2d2f', lineHeight: 1.6,
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>{DISCLAIMER}</div>
      {children}
      <div style={{ marginTop: 10, display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Link to="/terms" style={link}>Terms</Link>
        <Link to="/privacy" style={link}>Privacy</Link>
      </div>
    </footer>
  )
}
