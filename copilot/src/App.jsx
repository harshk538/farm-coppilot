import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Home from './pages/Home';
import Advisory from './pages/Advisory';
import Treatment from './pages/Treatment';
import Weather from './pages/Weather';
import Orders from './pages/Orders';
import Equipment from './pages/Equipment';
import AuthModal from './components/AuthModal';
import './App.css';

const navItems = [
  { path: '/advisory', label: 'Advisory' },
  { path: '/treatment', label: 'Treatment' },
  { path: '/weather', label: 'Weather' },
  { path: '/orders', label: 'Orders' },
  { path: '/equipment', label: 'Equipment' },
];

const mobileNavItems = [
  { path: '/', label: 'Home 🌾' },
  { path: '/advisory', label: 'Advisory' },
  { path: '/treatment', label: 'Treatment' },
  { path: '/weather', label: 'Weather' },
  { path: '/orders', label: 'Orders' },
  { path: '/equipment', label: 'Equipment' },
];

function Navbar({ user, onLogin, onSignup, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      backgroundColor: 'rgba(10,10,10,0.92)',
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
            <span style={{ fontSize: '18px' }}>🌾</span>
            Farm Copilot
          </Link>

          {/* Mobile Hamburger Icon Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="nav-mobile-only"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '18px',
              padding: '6px 12px',
              cursor: 'pointer',
              alignItems: 'center',
              justify: 'center',
            }}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* CENTER: Desktop Nav links */}
        <div className="nav-desktop-only" style={{ alignItems: 'center', gap: '4px' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: isActive ? '#fff' : '#888',
                textDecoration: 'none',
                backgroundColor: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                transition: 'all 0.15s ease',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* RIGHT: Auth buttons or user info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <div className="nav-desktop-only" style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
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
                  padding: '5px 12px', transition: 'all 0.15s',
                }}
              >
                Log out
              </button>
            </>
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
                  padding: '6px 14px',
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
        <div className="nav-mobile-only" style={{
          backgroundColor: 'rgba(12,12,15,0.98)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 20px 30px rgba(0,0,0,0.6)',
        }}>
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: isActive ? '#a78bfa' : '#eee',
                textDecoration: 'none',
                backgroundColor: isActive ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
                border: isActive ? '1px solid rgba(167,139,250,0.25)' : '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
              })}
            >
              <span>{item.label}</span>
              <span style={{ fontSize: '12px', color: '#666' }}>→</span>
            </NavLink>
          ))}
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
                  <Orders />
                </PageWrapper>
              }
            />
            <Route
              path="/equipment"
              element={
                <PageWrapper title="Equipment & Machinery Rental" subtitle="Rent tractors, harvesters, and farm machinery from nearby equipment owners at fixed rates">
                  <Equipment />
                </PageWrapper>
              }
            />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}