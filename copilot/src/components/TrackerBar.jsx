import { Link } from 'react-router-dom';
import { useTracking } from '../context/TrackingContext';

// Small floating bar shown on EVERY page (Orders, Equipment, Advisory, etc.)
// whenever a delivery/equipment is being tracked, so switching pages never
// hides or pauses the tracking — only closing this bar or arriving does.
export default function TrackerBar() {
  const { tracking, arrived, secondsLeft, stopTracking } = useTracking();
  if (!tracking) return null;

  const icon = tracking.type === 'order' ? '📦' : '🚜';

  return (
    <div style={{
      position: 'fixed',
      bottom: '18px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '9px 10px 9px 16px',
      borderRadius: '999px',
      background: 'rgba(12,12,14,0.96)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
      backdropFilter: 'blur(10px)',
      maxWidth: 'calc(100vw - 24px)',
    }}>
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        backgroundColor: arrived ? '#34d399' : '#f97316',
        boxShadow: arrived ? '0 0 8px #34d399' : '0 0 8px #f97316',
      }} />
      <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {arrived
          ? `✅ ${tracking.label} arrived`
          : `${icon} ${tracking.label} — ETA ${secondsLeft}s`}
      </span>
      <Link
        to="/treatment"
        style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
      >
        View Map
      </Link>
      <button
        onClick={stopTracking}
        aria-label="Dismiss tracking"
        style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1 }}
      >
        ✕
      </button>
    </div>
  );
}
