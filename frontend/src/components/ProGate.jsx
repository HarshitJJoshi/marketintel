import { useAuth } from '../context/AuthContext'

const C = {
  bg: "#181a1b", surface: "#1f2223", surfaceAlt: "#26292b", border: "#2e3234",
  text: "#ececec", textMuted: "#9ba1a6", textDim: "#5f6568",
  accent: "#4cc2c9", accentDim: "#153b3d",
}

export default function ProGate({ children, feature = "this feature", variant = "overlay" }) {
  const { isPro } = useAuth()
  if (isPro) return children

  // Overlay variant — shows children behind a locked overlay
  if (variant === "overlay") {
    return (
      <div style={{ position: 'relative', pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ opacity: 0.35, filter: 'blur(2px)' }}>
          {children}
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(24,26,27,0.5)',
          pointerEvents: 'auto',
        }}>
          <UpgradeCard feature={feature} />
        </div>
      </div>
    )
  }

  // Solid variant — no children shown, just the upgrade card
  return <UpgradeCard feature={feature} />
}

function UpgradeCard({ feature }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 10,
      padding: '18px 22px', maxWidth: 340, textAlign: 'center',
      boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        color: C.accent, marginBottom: 8, textTransform: 'uppercase',
      }}>Pro feature</div>
      <div style={{ fontSize: 14, fontWeight: 650, color: C.text, marginBottom: 6 }}>
        Unlock {feature}
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
        Upgrade to Pro for full access to signals, congress trades, historical tracking and strategies.
      </div>
      <button onClick={() => window.location.href = '/upgrade'} style={{
        padding: '8px 18px', background: C.accent, color: C.bg,
        border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
      }}>Upgrade to Pro</button>
    </div>
  )
}
