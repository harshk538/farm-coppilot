import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

/* ─────────────────────────────────────────────
   GLOBAL STYLES — hero + showcase keyframes
───────────────────────────────────────────── */
const ALL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes orbFloat1 {
    0%, 100% { transform: translate(0px, 0px) scale(1); }
    33%  { transform: translate(30px, -40px) scale(1.06); }
    66%  { transform: translate(-20px, 20px) scale(0.96); }
  }
  @keyframes orbFloat2 {
    0%, 100% { transform: translate(0px, 0px) scale(1); }
    40%  { transform: translate(-35px, 30px) scale(1.08); }
    70%  { transform: translate(20px, -20px) scale(0.94); }
  }
  @keyframes orbFloat3 {
    0%, 100% { transform: translate(0px, 0px); }
    50%  { transform: translate(15px, -25px); }
  }
  @keyframes shimmerText {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes particleDrift {
    0%   { transform: translateY(0px) translateX(0px); opacity: 0.6; }
    50%  { transform: translateY(-18px) translateX(8px); opacity: 1; }
    100% { transform: translateY(0px) translateX(0px); opacity: 0.6; }
  }
  @keyframes badgePop {
    0%   { opacity: 0; transform: translateY(12px) scale(0.9); }
    60%  { transform: translateY(-2px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes gridFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 32px rgba(139,92,246,0.25); }
    50%  { box-shadow: 0 0 52px rgba(139,92,246,0.55), 0 0 80px rgba(168,85,247,0.2); }
  }

  /* ── Showcase animations ── */
  @keyframes sc-scanBar {
    0%   { left: -100%; }
    100% { left: 110%; }
  }
  @keyframes sc-barFill {
    from { width: 0%; }
    to   { width: var(--target-w, 80%); }
  }
  @keyframes sc-slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sc-fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sc-pinDrop {
    0%   { opacity: 0; transform: translateY(-20px) scale(0.7); }
    70%  { transform: translateY(4px) scale(1.1); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes sc-meterFill {
    from { width: 0%; }
    to   { width: 72%; }
  }
  @keyframes sc-blinkCursor {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes sc-verScan {
    0%   { top: 0%; }
    100% { top: 100%; }
  }
  @keyframes sc-verPop {
    0%   { opacity: 0; transform: scale(0.6); }
    70%  { transform: scale(1.12); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes sc-prodCard {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sc-rowIn {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .hero-btn-primary  { animation: glowPulse 2.8s ease-in-out infinite; }
  .hero-btn-primary:hover  { transform: translateY(-2px) scale(1.03) !important; }
  .hero-btn-secondary:hover {
    transform: translateY(-1px) !important;
    border-color: rgba(255,255,255,0.3) !important;
    color: #fff !important;
    background-color: rgba(255,255,255,0.06) !important;
  }

  /* Showcase row hover border glow */
  .sc-anim-panel {
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .sc-anim-panel:hover {
    border-color: rgba(139,92,246,0.35) !important;
    box-shadow: 0 0 40px rgba(139,92,246,0.1);
  }
`;

/* ─────────────────────────────────────────
   GLASS PANEL helper
───────────────────────────────────────────── */
const glassPanel = {
  backgroundColor: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  overflow: 'hidden',
  position: 'relative',
};

/* ═══════════════════════════════════════════
   ANIMATION 1 — AI Crop Advisory
═══════════════════════════════════════════ */
function AdvisoryAnimation({ isPlaying }) {
  const FULL_TEXT = 'Powdery Mildew detected — Severity: High';
  const [typed, setTyped] = useState('');
  const [scanDone, setScanDone] = useState(false);
  const [confVisible, setConfVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      clearTimeout(timerRef.current);
      setTyped('');
      setScanDone(false);
      setConfVisible(false);
      return;
    }
    // scan bar: 1.2s, then type, then confidence bar
    timerRef.current = setTimeout(() => {
      setScanDone(true);
      let i = 0;
      const typeNext = () => {
        setTyped(FULL_TEXT.slice(0, i + 1));
        i++;
        if (i < FULL_TEXT.length) timerRef.current = setTimeout(typeNext, 38);
        else timerRef.current = setTimeout(() => setConfVisible(true), 200);
      };
      typeNext();
    }, 1300);
    return () => clearTimeout(timerRef.current);
  }, [isPlaying]);

  const panelBg = { padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' };

  return (
    <div style={panelBg}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>gemini-advisory.ai</span>
      </div>

      {/* Crop image box */}
      <div style={{
        position: 'relative', borderRadius: '10px', overflow: 'hidden',
        backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
        height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '52px', filter: 'drop-shadow(0 2px 8px rgba(34,197,94,0.3))' }}>🌿</span>
        {/* Scan bar */}
        {isPlaying && !scanDone && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.4), transparent)',
            animation: 'sc-scanBar 1.2s ease forwards',
          }} />
        )}
        {scanDone && (
          <div style={{
            position: 'absolute', bottom: '6px', right: '8px',
            fontSize: '10px', fontWeight: 600, color: '#a78bfa',
            backgroundColor: 'rgba(139,92,246,0.15)', padding: '2px 8px', borderRadius: '100px',
            border: '1px solid rgba(139,92,246,0.25)',
          }}>Analyzed ✓</div>
        )}
      </div>

      {/* Diagnosis result */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px',
        padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)',
        minHeight: '44px',
      }}>
        <div style={{ fontSize: '10px', color: '#555', marginBottom: '6px', letterSpacing: '0.5px' }}>AI DIAGNOSIS</div>
        <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500, minHeight: '18px' }}>
          {typed}
          {isPlaying && typed.length < FULL_TEXT.length && (
            <span style={{ animation: 'sc-blinkCursor 0.7s infinite', borderRight: '2px solid #a78bfa', marginLeft: '1px' }} />
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ opacity: confVisible ? 1 : 0, transition: 'opacity 0.4s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginBottom: '5px' }}>
          <span>Confidence Score</span><span style={{ color: '#a78bfa' }}>85%</span>
        </div>
        <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '100px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '100px',
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            width: confVisible ? '85%' : '0%',
            transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ANIMATION 2 — Treatment Finder
═══════════════════════════════════════════ */
function TreatmentAnimation({ isPlaying }) {
  const [step, setStep] = useState(0); // 0=idle 1=dropdown 2=cards 3=map
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      clearTimeout(timerRef.current);
      setStep(0);
      return;
    }
    setStep(1);
    timerRef.current = setTimeout(() => setStep(2), 600);
    timerRef.current = setTimeout(() => setStep(3), 1600);
  }, [isPlaying]);

  const products = [
    { name: 'Tricyclazole 75% WP', dose: '0.6 g/L', type: 'Fungicide', color: '#a78bfa' },
    { name: 'Propiconazole 25% EC', dose: '1 ml/L', type: 'Fungicide', color: '#818cf8' },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>treatment-finder</span>
      </div>

      {/* Dropdown selector */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px',
        padding: '10px 14px', border: '1px solid rgba(139,92,246,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'border-color 0.3s',
      }}>
        <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
          {step >= 1 ? '🌾 Rice — Blast Disease' : 'Select crop & disease…'}
        </span>
        <span style={{ color: '#555', fontSize: '10px' }}>▼</span>
      </div>

      {/* Product cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {products.map((p, i) => (
          <div key={i} style={{
            backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '10px',
            padding: '12px 14px', border: '1px solid rgba(255,255,255,0.07)',
            opacity: step >= 2 ? 1 : 0,
            transform: step >= 2 ? 'translateY(0)' : 'translateY(14px)',
            transition: `opacity 0.4s ${i * 0.15}s, transform 0.4s ${i * 0.15}s`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '2px' }}>{p.name}</div>
              <div style={{ fontSize: '10px', color: '#555' }}>Dose: {p.dose}</div>
            </div>
            <span style={{
              fontSize: '9px', fontWeight: 700, color: p.color,
              backgroundColor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
              padding: '2px 7px', borderRadius: '100px',
            }}>{p.type}</span>
          </div>
        ))}
      </div>

      {/* Map pin */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        opacity: step >= 3 ? 1 : 0,
        animation: step >= 3 ? 'sc-pinDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
        backgroundColor: 'rgba(34,197,94,0.06)', borderRadius: '8px',
        padding: '9px 12px', border: '1px solid rgba(34,197,94,0.15)',
      }}>
        <span style={{ fontSize: '18px' }}>📍</span>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80' }}>3 shops nearby</div>
          <div style={{ fontSize: '10px', color: '#555' }}>Krishi Kendra · AgriMart · FarmPlus</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ANIMATION 3 — Weather & Disease Risk
═══════════════════════════════════════════ */
function WeatherAnimation({ isPlaying }) {
  const [meterFill, setMeterFill] = useState(false);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      clearTimeout(timerRef.current);
      setMeterFill(false);
      setAlertsVisible(false);
      return;
    }
    timerRef.current = setTimeout(() => setMeterFill(true), 300);
    timerRef.current = setTimeout(() => setAlertsVisible(true), 1100);
  }, [isPlaying]);

  const alerts = [
    { icon: '🍄', label: 'Fungal Risk', level: 'High', color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
    { icon: '🐛', label: 'Pest Risk', level: 'Medium', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
    { icon: '🌧️', label: 'Blight Risk', level: 'Low', color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>weather-risk.live</span>
      </div>

      {/* Weather stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px',
      }}>
        {[
          { icon: '🌡️', val: '31°C', label: 'Temp' },
          { icon: '💧', val: '78%', label: 'Humidity' },
          { icon: '💨', val: '12 km/h', label: 'Wind' },
        ].map((s) => (
          <div key={s.label} style={{
            backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px',
            padding: '10px 8px', border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{s.val}</div>
            <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Risk meter */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginBottom: '6px' }}>
          <span>Overall Disease Risk</span>
          <span style={{ color: '#f87171', fontWeight: 600 }}>72% — HIGH</span>
        </div>
        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '100px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '100px',
            background: 'linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)',
            width: meterFill ? '72%' : '0%',
            transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
      </div>

      {/* Alert badges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {alerts.map((a, i) => (
          <div key={a.label} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            backgroundColor: a.bg, borderRadius: '8px',
            padding: '8px 12px', border: `1px solid ${a.border}`,
            opacity: alertsVisible ? 1 : 0,
            transform: alertsVisible ? 'translateX(0)' : 'translateX(-12px)',
            transition: `opacity 0.35s ${i * 0.12}s, transform 0.35s ${i * 0.12}s`,
          }}>
            <span style={{ fontSize: '14px' }}>{a.icon}</span>
            <span style={{ fontSize: '12px', color: '#ccc', flex: 1 }}>{a.label}</span>
            <span style={{
              fontSize: '9px', fontWeight: 700, color: a.color,
              padding: '2px 7px', borderRadius: '100px',
              backgroundColor: `${a.border}`,
            }}>{a.level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ANIMATION 4 — Product Verification
═══════════════════════════════════════════ */
function VerifyAnimation({ isPlaying }) {
  const FULL_CODE = 'AGR-2024-7X9K';
  const [typedCode, setTypedCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [verified, setVerified] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      clearTimeout(timerRef.current);
      setTypedCode('');
      setScanning(false);
      setVerified(false);
      return;
    }
    let i = 0;
    const typeNext = () => {
      setTypedCode(FULL_CODE.slice(0, i + 1));
      i++;
      if (i < FULL_CODE.length) timerRef.current = setTimeout(typeNext, 80);
      else {
        timerRef.current = setTimeout(() => {
          setScanning(true);
          timerRef.current = setTimeout(() => {
            setScanning(false);
            setVerified(true);
          }, 1400);
        }, 300);
      }
    };
    timerRef.current = setTimeout(typeNext, 200);
    return () => clearTimeout(timerRef.current);
  }, [isPlaying]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>verify.farmcopilot</span>
      </div>

      {/* Input field */}
      <div>
        <div style={{ fontSize: '10px', color: '#555', marginBottom: '6px', letterSpacing: '0.5px' }}>BATCH CODE</div>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '8px',
          padding: '10px 14px', border: '1px solid rgba(139,92,246,0.3)',
          fontFamily: 'monospace', fontSize: '15px', fontWeight: 600, color: '#a78bfa',
          letterSpacing: '2px', minHeight: '42px', display: 'flex', alignItems: 'center',
        }}>
          {typedCode}
          {isPlaying && typedCode.length < FULL_CODE.length && (
            <span style={{ borderRight: '2px solid #a78bfa', animation: 'sc-blinkCursor 0.7s infinite', height: '16px', display: 'inline-block', marginLeft: '2px' }} />
          )}
        </div>
      </div>

      {/* Barcode + scan */}
      <div style={{
        position: 'relative', borderRadius: '10px', overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        padding: '16px', display: 'flex', justifyContent: 'center',
      }}>
        {/* Barcode bars */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'stretch', height: '48px' }}>
          {[3,1,4,2,3,1,2,4,1,3,2,1,3,4,2,1,3,2].map((w, i) => (
            <div key={i} style={{
              width: `${w * 2}px`, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '1px',
            }} />
          ))}
        </div>
        {/* Scan line */}
        {scanning && (
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, transparent, #a78bfa, transparent)',
            animation: 'sc-verScan 0.7s ease-in-out infinite',
            boxShadow: '0 0 8px rgba(167,139,250,0.8)',
          }} />
        )}
      </div>

      {/* Result */}
      {verified && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center',
          animation: 'sc-verPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: '10px',
            padding: '10px 20px', border: '1px solid rgba(34,197,94,0.2)',
            width: '100%', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80' }}>Authentic Product</span>
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>Bayer Confidor 200 SL · Batch verified</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ANIMATION 5 — Smart Products
═══════════════════════════════════════════ */
function ProductsAnimation({ isPlaying }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      clearTimeout(timerRef.current);
      setVisibleCount(0);
      return;
    }
    const showNext = (n) => {
      setVisibleCount(n);
      if (n < 3) timerRef.current = setTimeout(() => showNext(n + 1), 220);
    };
    timerRef.current = setTimeout(() => showNext(1), 200);
    return () => clearTimeout(timerRef.current);
  }, [isPlaying]);

  const products = [
    { name: 'Urea 46% N', cat: 'Fertilizer', price: '₹320/bag', rating: '4.8', catColor: '#4ade80', catBg: 'rgba(74,222,128,0.1)' },
    { name: 'Chlorpyrifos 20% EC', cat: 'Pesticide', price: '₹480/L', rating: '4.5', catColor: '#f87171', catBg: 'rgba(248,113,113,0.1)' },
    { name: 'Mancozeb 75% WP', cat: 'Fungicide', price: '₹260/kg', rating: '4.7', catColor: '#c084fc', catBg: 'rgba(192,132,252,0.1)' },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>smart-products.ai</span>
      </div>

      {/* Category filter tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['All', 'Fertilizer', 'Pesticide', 'Fungicide'].map((c, i) => (
          <span key={c} style={{
            fontSize: '10px', fontWeight: 600,
            padding: '3px 10px', borderRadius: '100px',
            backgroundColor: i === 0 ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${i === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
            color: i === 0 ? '#a78bfa' : '#555',
          }}>{c}</span>
        ))}
      </div>

      {/* Product cards */}
      {products.map((p, i) => (
        <div key={p.name} style={{
          backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: '10px',
          padding: '12px 14px', border: '1px solid rgba(255,255,255,0.07)',
          opacity: visibleCount > i ? 1 : 0,
          transform: visibleCount > i ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.35s, transform 0.35s',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '3px' }}>{p.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '9px', fontWeight: 700, color: p.catColor,
                backgroundColor: p.catBg, padding: '1px 6px', borderRadius: '100px',
              }}>{p.cat}</span>
              <span style={{ fontSize: '10px', color: '#555' }}>⭐ {p.rating}</span>
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', whiteSpace: 'nowrap' }}>{p.price}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   FEATURE SHOWCASE ROW
═══════════════════════════════════════════ */
function ShowcaseRow({ animLeft, title, tag, desc, path, icon, AnimComponent, navigate }) {
  const [hovered, setHovered] = useState(false);

  const animPanel = (
    <div
      className="sc-anim-panel"
      style={{
        ...glassPanel,
        cursor: 'default',
        minHeight: '340px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover hint */}
      {!hovered && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          fontSize: '9px', color: '#444', fontWeight: 500,
          backgroundColor: 'rgba(255,255,255,0.03)', padding: '3px 8px',
          borderRadius: '100px', border: '1px solid rgba(255,255,255,0.06)',
          pointerEvents: 'none', zIndex: 2,
        }}>▶ Hover to play</div>
      )}
      <AnimComponent isPlaying={hovered} />
    </div>
  );

  const textPanel = (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '8px 0',
    }}>
      {/* Tag */}
      <span style={{
        display: 'inline-flex', alignSelf: 'flex-start',
        fontSize: '10px', fontWeight: 700, color: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.22)',
        padding: '3px 10px', borderRadius: '100px', letterSpacing: '0.8px',
        textTransform: 'uppercase', marginBottom: '20px',
      }}>{tag}</span>

      {/* Icon + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '36px' }}>{icon}</span>
        <h3 style={{
          fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800,
          letterSpacing: '-0.8px', color: '#fff', margin: 0, lineHeight: 1.1,
        }}>{title}</h3>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '15px', color: '#666', lineHeight: 1.75,
        margin: '0 0 28px', maxWidth: '420px',
      }}>{desc}</p>

      {/* CTA */}
      <button
        onClick={() => navigate(path)}
        style={{
          display: 'inline-flex', alignSelf: 'flex-start',
          alignItems: 'center', gap: '8px',
          backgroundColor: 'transparent', color: '#a78bfa',
          border: '1px solid rgba(139,92,246,0.35)', borderRadius: '10px',
          padding: '10px 22px', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.12)';
          e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)';
          e.currentTarget.style.transform = 'none';
        }}
      >
        Explore {title} <span style={{ opacity: 0.6 }}>→</span>
      </button>
    </div>
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '48px',
      alignItems: 'center',
      padding: '64px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {animLeft ? animPanel : textPanel}
      {animLeft ? textPanel : animPanel}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN HOME COMPONENT
═══════════════════════════════════════════ */
export default function Home() {
  const navigate = useNavigate();
  const [aiStatus, setAiStatus] = useState('checking');

  useEffect(() => {
    const apiUrl = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '/api/verify/gemini-handshake' : `http://${window.location.hostname}:5005/api/verify/gemini-handshake`;
    axios.get(apiUrl)
      .then(res => setAiStatus(res.data.success ? 'online' : 'quota_exhausted'))
      .catch(() => setAiStatus('offline'));
  }, []);

  const stats = [
    { icon: '⚡', value: 'Gemini AI', label: "Google's most advanced model for crop diagnosis" },
    { icon: '🗺️', value: 'Live Maps', label: 'Find the nearest agricultural store in seconds' },
    { icon: '🛡️', value: 'Verified DB', label: 'Trusted database of authenticated farm products' },
    { icon: '🌐', value: '24/7', label: 'Always-on advisory — no waiting, instant answers' },
  ];

  const howItWorks = [
    { step: '01', title: 'Describe or Photograph', desc: 'Type a description of your crop issue or simply take a photo. The AI handles the rest.' },
    { step: '02', title: 'AI Diagnoses Instantly', desc: 'Google Gemini analyzes the input, identifies the disease or deficiency, and determines severity.' },
    { step: '03', title: 'Get Your Action Plan', desc: 'Receive specific product recommendations, dosage, application schedule and nearby shop locations.' },
  ];

  const showcaseFeatures = [
    {
      icon: '🧠', title: 'AI Crop Advisory', tag: 'Powered by Gemini',
      desc: 'Upload a photo of your crops or describe the problem. Google Gemini AI instantly diagnoses diseases, pests, and nutrient deficiencies with actionable treatment recommendations.',
      path: '/advisory', Anim: AdvisoryAnimation,
    },
    {
      icon: '💊', title: 'Treatment Finder', tag: 'With Shop Finder',
      desc: 'Select your crop disease and get precise pesticide and fertilizer recommendations. Includes dosage instructions, application methods, and nearby agricultural shop discovery with maps.',
      path: '/treatment', Anim: TreatmentAnimation,
    },
    {
      icon: '🌦️', title: 'Weather & Disease Risk', tag: 'Live Weather Data',
      desc: 'Real-time weather analysis to predict disease outbreak risk before it happens. Get proactive alerts for fungal, bacterial, and pest-related threats based on your local conditions.',
      path: '/weather', Anim: WeatherAnimation,
    },
  ];

  return (
    <div style={{ paddingTop: '56px', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <style>{ALL_STYLES}</style>

      {/* ── HERO ── */}
      <section style={{
        textAlign: 'center', padding: '96px 32px 80px',
        width: '100%', position: 'relative', overflow: 'hidden',
      }}>
        {/* Floating gradient orbs */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-80px', left: '-120px', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)', animation: 'orbFloat1 9s ease-in-out infinite', filter: 'blur(2px)' }} />
          <div style={{ position: 'absolute', top: '-60px', right: '-100px', width: '360px', height: '360px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)', animation: 'orbFloat2 11s ease-in-out infinite', filter: 'blur(2px)' }} />
          <div style={{ position: 'absolute', bottom: '-100px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '240px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(99,60,220,0.12) 0%, transparent 70%)', animation: 'orbFloat3 13s ease-in-out infinite', filter: 'blur(8px)' }} />
        </div>
        {/* Dot-grid */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)', animation: 'gridFade 1.2s ease forwards' }} />
        {/* Particles */}
        {[...Array(6)].map((_, i) => (
          <div key={i} aria-hidden="true" style={{ position: 'absolute', width: i % 2 === 0 ? '4px' : '3px', height: i % 2 === 0 ? '4px' : '3px', borderRadius: '50%', backgroundColor: i % 3 === 0 ? 'rgba(139,92,246,0.6)' : i % 3 === 1 ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.25)', top: `${15 + i * 12}%`, left: `${8 + i * 15}%`, animation: `particleDrift ${3.5 + i * 0.7}s ease-in-out infinite`, animationDelay: `${i * 0.4}s`, pointerEvents: 'none', zIndex: 0 }} />
        ))}

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center', animation: 'badgePop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '100px', border: `1px solid ${aiStatus === 'online' ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.1)'}`, backgroundColor: aiStatus === 'online' ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.04)', fontSize: '12px', fontWeight: 500, color: aiStatus === 'online' ? '#6ee7b7' : '#666', letterSpacing: '0.2px', backdropFilter: 'blur(8px)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: aiStatus === 'online' ? '#34d399' : '#555', animation: 'pulse 2s infinite' }} />
              AI Engine {aiStatus === 'online' ? 'Online' : aiStatus === 'checking' ? 'Connecting...' : 'Offline'}
            </div>
          </div>

          <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.05, margin: '0 0 24px', color: '#fff', animation: 'fadeSlideUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.3s both' }}>
            Smart Farming,{' '}
            <span style={{ background: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 25%, #c084fc 50%, #7c3aed 75%, #a78bfa 100%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmerText 3.5s linear infinite' }}>
              simplified.
            </span>
          </h1>

          <p style={{ fontSize: '18px', color: '#777', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto 40px', animation: 'fadeSlideUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.5s both' }}>
            AI-powered crop diagnosis, disease treatment, product verification,
            and personalized farming recommendations — all in one place.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeSlideUp 0.75s cubic-bezier(0.22,1,0.36,1) 0.68s both' }}>
            <button className="hero-btn-primary" onClick={() => navigate('/advisory')} style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '10px', padding: '13px 28px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
              Get started <span style={{ opacity: 0.7 }}>→</span>
            </button>
            <button className="hero-btn-secondary" onClick={() => navigate('/treatment')} style={{ backgroundColor: 'transparent', color: '#ccc', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '13px 28px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
              Find Treatment
            </button>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── STATS BAR ── (hidden on mobile) */}
      <section className="home-desktop-only" style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {stats.map((s) => (
            <div key={s.value} style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE SHOWCASE ── (hidden on mobile) */}
      <section className="home-desktop-only" style={{ padding: '80px 48px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Everything in one platform
          </p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-1px', color: '#fff', margin: '0 0 16px', lineHeight: 1.1 }}>
            Every tool a modern farmer needs
          </h2>
          <p style={{ fontSize: '16px', color: '#555', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
            Hover any preview to see it come alive — each feature, animated in real time.
          </p>
        </div>

        {/* Alternating rows */}
        {showcaseFeatures.map((f, i) => (
          <ShowcaseRow
            key={f.title}
            animLeft={i % 2 === 0}
            title={f.title}
            tag={f.tag}
            desc={f.desc}
            path={f.path}
            icon={f.icon}
            AnimComponent={f.Anim}
            navigate={navigate}
          />
        ))}
      </section>

      {/* ── DIVIDER ── (hidden on mobile) */}
      <div className="home-desktop-only" style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', marginTop: '40px' }} />

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '80px 32px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>How it works</p>
          <h2 style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.8px', color: '#fff', margin: 0 }}>Get answers in seconds</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {howItWorks.map((step) => (
            <div key={step.step} style={{ padding: '32px 28px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#a78bfa', marginBottom: '20px', letterSpacing: '0.5px' }}>{step.step}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.2px' }}>{step.title}</h3>
              <p style={{ fontSize: '13.5px', color: '#666', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: '0 32px 96px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.08) 100%)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '20px', padding: '56px 48px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', margin: '0 0 12px' }}>Start protecting your crops today</h2>
          <p style={{ fontSize: '15px', color: '#777', margin: '0 0 32px', maxWidth: '420px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>
            Free to use. No account needed. Get your first AI crop diagnosis in under 30 seconds.
          </p>
          <button
            onClick={() => navigate('/advisory')}
            style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '10px', padding: '13px 32px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#7c3aed'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#8b5cf6'; }}
          >
            Try AI Advisory Free <span style={{ opacity: 0.7 }}>→</span>
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px', textAlign: 'center', color: '#444', fontSize: '13px' }}>
        © 2025 Farm Copilot — Smart Farming Intelligence
      </footer>
    </div>
  );
}