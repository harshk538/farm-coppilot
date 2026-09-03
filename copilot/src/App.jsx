import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Home from './pages/Home';
import Advisory from './pages/Advisory';
import Treatment from './pages/Treatment';
import Weather from './pages/Weather';
import Orders from './pages/Orders';
import Equipment from './pages/Equipment';
import Farms from './pages/Farms';
import SoilTest from './pages/SoilTest';
import SoilReport from './pages/SoilReport';
import AuthModal from './components/AuthModal';
import TrackerBar from './components/TrackerBar';
import AgentWidget from './components/AgentWidget';
import { TrackingProvider } from './context/TrackingContext';
import './App.css';

const navItems = [
  { path: '/advisory', label: 'Advisory' },
  { path: '/treatment', label: 'Treatment' },
  { path: '/weather', label: 'Weather' },
  { path: '/orders', label: 'Orders' },
  { path: '/equipment', label: 'Equipment' },
  { path: '/farms', label: 'My Farms' },
  { path: '/soil', label: 'Soil Test' },
  { path: '/soil-report', label: 'Soil Report' },
];

const mobileNavItems = [
  { path: '/', label: 'Home 🌾' },
  { path: '/advisory', label: 'Advisory' },
  { path: '/treatment', label: 'Treatment' },
  { path: '/weather', label: 'Weather' },
  { path: '/orders', label: 'Orders' },
  { path: '/equipment', label: 'Equipment' },
  { path: '/farms', label: 'My Farms' },
  { path: '/soil', label: 'Soil Test' },
  { path: '/soil-report', label: 'Soil Report' },
];

/* Per-page accent, all colors already used elsewhere in this app —
   violet (brand default), indigo (Treatment's own product-card color),
   emerald (existing success/online color), amber & sky-blue (already
   used throughout Orders.jsx / Equipment.jsx). Matches the accent
   system on the home page's feature showcase. */
const NAV_ACCENTS = {
  '/advisory': '139,92,246',
  '/treatment': '99,102,241',
  '/weather': '16,185,129',
  '/orders': '245,158,11',
  '/equipment': '96,165,250',
  '/farms': '52,211,153',
  '/soil': '251,146,60',
  '/soil-report': '167,139,250',
};
const DEFAULT_ACCENT_RGB = '139,92,246';

function Navbar({ user, onLogin, onSignup, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="app-navbar" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      backgroundColor: 'rgba(8,8,10,0.75)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    }}>
      <nav className="nav-grid-container" style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        height: '56px',
        alignItems: 'center',
      }}>
        {/* LEFT: Logo on Desktop, Hamburger Button on Mobile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          {/* Desktop Logo */}
          <Link to="/" className="nav-desktop-only" style={{
            alignItems: 'center', gap: '8px',
            color: '#fff', fontWeight: 600, fontSize: '15px',
            textDecoration: 'none', letterSpacing: '-0.2px',
          }}>
            <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' }}>🌾</span>
            Farm Copilot
          </Link>

          {/* Mobile Hamburger Icon Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="nav-mobile-only"
            style={{
              background: mobileMenuOpen ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.05)',
              border: mobileMenuOpen ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#fff',
              width: '44px',
              height: '44px',
              padding: 0,
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>

        {/* CENTER: Desktop Nav links */}
        <div className="nav-desktop-only" style={{ alignItems: 'center', gap: '4px' }}>
          {navItems.map((item) => {
            const rgb = NAV_ACCENTS[item.path];
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isActive ? `rgb(${rgb})` : '#888',
                  textDecoration: 'none',
                  backgroundColor: isActive ? `rgba(${rgb},0.12)` : 'transparent',
                  border: isActive ? `1px solid rgba(${rgb},0.24)` : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#888'; }}
              >
                {item.label}
              </NavLink>
            );
          })}
        </div>

        {/* RIGHT: Auth buttons or user info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          {user ? (
            <div className="nav-desktop-only" style={{ alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 14px rgba(139,92,246,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color: '#fff',
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#ccc' }}>
                  {user.name.split(' ')[0]}
                </span>
              </div>
              <button
                onClick={onLogout}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', cursor: 'pointer',
                  color: '#666', fontSize: '12px', fontWeight: 500,
                  padding: '5px 12px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'; e.currentTarget.style.color = '#f87171'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#666'; }}
              >
                Log out
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Auth Buttons */}
              <button
                onClick={onLogin}
                className="nav-desktop-only"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#888', fontSize: '13px', fontWeight: 500,
                  transition: 'color 0.15s',
                }}
              >
                Log in
              </button>
              <button
                onClick={onSignup}
                className="nav-desktop-only"
                style={{
                  backgroundColor: '#fff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                Sign up
              </button>

              {/* Mobile Auth Pill Button */}
              <button
                onClick={onLogin}
                className="nav-mobile-only"
                style={{
                  backgroundColor: '#fff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '9px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Log in / Sign up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* MOBILE DROPDOWN MENU */}
      {mobileMenuOpen && (
        <div className="nav-mobile-only nav-drawer-enter" style={{
          backgroundColor: 'rgba(12,12,15,0.98)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 20px 30px rgba(0,0,0,0.6)',
        }}>
          {mobileNavItems.map((item) => {
            const rgb = NAV_ACCENTS[item.path] || DEFAULT_ACCENT_RGB;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isActive ? `rgb(${rgb})` : '#eee',
                  textDecoration: 'none',
                  backgroundColor: isActive ? `rgba(${rgb},0.12)` : 'rgba(255,255,255,0.03)',
                  border: isActive ? `1px solid rgba(${rgb},0.25)` : '1px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                })}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: '12px', color: '#666' }}>→</span>
              </NavLink>
            );
          })}

          <a
            href="/vendor/"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#a78bfa',
              textDecoration: 'none',
              backgroundColor: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              marginTop: '4px'
            }}
          >
            <span>🏬 Vendor Portal</span>
            <span style={{ fontSize: '12px', color: '#a78bfa' }}>→</span>
          </a>

          {/* Account row — folded in here instead of crowding the top bar */}
          {user && (
            <div style={{
              marginTop: '8px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 14px rgba(139,92,246,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: '#fff',
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span style={{
                  fontSize: '14px', fontWeight: 600, color: '#eee',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.name}
                </span>
              </div>
              <button
                onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
                  color: '#888', fontSize: '12px', fontWeight: 500,
                  padding: '9px 14px',
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

/* Page wrapper — gives each section its own header */
function PageWrapper({ title, subtitle, children }) {
  return (
    <div style={{ paddingTop: '56px', minHeight: '100vh' }}>
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 0 20px',
        marginBottom: '20px',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 32px' }}>
          <h1 style={{
            fontSize: '30px',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.5px',
            margin: 0,
          }}>{title}</h1>
          {subtitle && (
            <p style={{ marginTop: '8px', color: '#666', fontSize: '15px', margin: '8px 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 32px 80px' }}>
        {children}
      </div>
    </div>
  );
}

export { PageWrapper };

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fc_user')); } catch { return null; }
  });
  const [authModal, setAuthModal] = useState(null); // 'login' | 'signup' | null

  // Restore session on reload
  useEffect(() => {
    const token = localStorage.getItem('fc_token');
    const savedUser = localStorage.getItem('fc_user');
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fc_token');
    localStorage.removeItem('fc_user');
    setUser(null);
  };

  return (
    <BrowserRouter>
    <TrackingProvider>
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        {/* Subtle purple radial glow at top */}
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '900px', height: '500px', pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(139,92,246,0.07) 0%, transparent 70%)',
        }} />

        <Navbar
          user={user}
          onLogin={() => setAuthModal('login')}
          onSignup={() => setAuthModal('signup')}
          onLogout={handleLogout}
        />

        {/* Auth Modal */}
        {authModal && (
          <AuthModal
            mode={authModal}
            onClose={() => setAuthModal(null)}
            onSuccess={(userData) => setUser(userData)}
          />
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/advisory"
              element={
                <PageWrapper title="AI Advisory" subtitle="Describe your crop issue or upload a photo for instant AI-powered diagnosis">
                  <Advisory user={user} onLogin={() => setAuthModal('login')} />
                </PageWrapper>
              }
            />
            <Route
              path="/treatment"
              element={
                <PageWrapper title="Treatment Finder" subtitle="Get pesticide & fertilizer recommendations based on your crop disease">
                  <Treatment />
                </PageWrapper>
              }
            />
            <Route
              path="/weather"
              element={
                <PageWrapper title="Weather & Disease Risk" subtitle="Real-time disease risk prediction based on your local weather conditions">
                  <Weather user={user} />
                </PageWrapper>
              }
            />
            <Route
              path="/orders"
              element={
                <PageWrapper title="Orders & Stock Confirmation" subtitle="Track live stock availability & place chemical orders from local vendors">
                  <Orders user={user} onLogin={() => setAuthModal('login')} />
                </PageWrapper>
              }
            />
            <Route
              path="/soil-report"
              element={
                <PageWrapper title="Soil Report" subtitle="Your soil explained in full — what every reading means, what to do about it, which crops suit this field, and where it is heading">
                  <SoilReport user={user} onLogin={() => setAuthModal('login')} />
                </PageWrapper>
              }
            />
            <Route
              path="/soil"
              element={
                <PageWrapper title="Soil Test" subtitle="Read your NPK meter live over USB, save each stable reading, and build your farm's soil history">
                  <SoilTest user={user} onLogin={() => setAuthModal('login')} />
                </PageWrapper>
              }
            />
            <Route
              path="/farms"
              element={
                <PageWrapper title="My Farms" subtitle="Manage each of your fields separately — its location, its crop, and its own soil history">
                  <Farms user={user} onLogin={() => setAuthModal('login')} />
                </PageWrapper>
              }
            />
            <Route
              path="/equipment"
              element={
                <PageWrapper title="Equipment & Machinery Rental" subtitle="Rent tractors, harvesters, and farm machinery from nearby equipment owners at fixed rates">
                  <Equipment user={user} onLogin={() => setAuthModal('login')} />
                </PageWrapper>
              }
            />
          </Routes>
        </div>
        <TrackerBar />
        <AgentWidget user={user} />
      </div>
    </TrackingProvider>
    </BrowserRouter>
  );
}