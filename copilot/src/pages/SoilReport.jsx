import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import SoilAnalysis from '../components/SoilAnalysis';
import { API_BASE_URL } from '../config';

const FARMS_API = `${API_BASE_URL}/api/farms`;
const SOIL_API = `${API_BASE_URL}/api/soil`;

const cardStyle = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '20px',
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  padding: '11px 14px',
  color: '#fff',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '11px', fontWeight: 600, color: '#666',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  marginBottom: '6px', display: 'block',
};

export default function SoilReport({ user, onLogin }) {
  const [searchParams] = useSearchParams();
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Arriving from the Soil Test page ("View AI Report") lands on that farm.
  const farmFromLink = searchParams.get('farm');

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    (async () => {
      try {
        const res = await axios.get(FARMS_API, { params: { farmerId: user.id } });
        if (res.data.success) {
          setFarms(res.data.farms);
          const preferred = res.data.farms.find(f => f.id === farmFromLink)?.id;
          setSelectedFarmId(prev => prev || preferred || res.data.farms[0]?.id || '');
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !selectedFarmId) return;
    (async () => {
      try {
        const res = await axios.get(`${SOIL_API}/tests`, { params: { farmerId: user.id, farmId: selectedFarmId } });
        if (res.data.success) setTests(res.data.tests);
      } catch {
        setTests([]);
      }
    })();
  }, [user?.id, selectedFarmId]);

  const selectedFarm = farms.find(f => f.id === selectedFarmId) || null;

  if (!user) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
        <h3 style={{ color: '#fff', fontSize: '17px', margin: '0 0 8px' }}>Log in to see your soil report</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          The report is built from the soil tests saved for your farms.
        </p>
        <button
          onClick={onLogin}
          style={{
            padding: '10px 22px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >Log in</button>
      </div>
    );
  }

  if (loading) return <p style={{ color: '#666', fontSize: '14px' }}>Loading…</p>;

  if (farms.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌱</div>
        <h3 style={{ color: '#fff', fontSize: '17px', margin: '0 0 8px' }}>Add a farm first</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          Every report belongs to one field.
        </p>
        <Link to="/farms" style={{
          display: 'inline-block', padding: '10px 22px',
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
        }}>Go to My Farms</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Farm selector */}
      <div style={cardStyle}>
        <label style={labelStyle}>Report For Which Farm?</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '220px', cursor: 'pointer' }}
          >
            {farms.map(f => <option key={f.id} value={f.id} style={{ background: '#111113' }}>{f.name}</option>)}
          </select>
          <Link to="/soil" style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Soil Test
          </Link>
        </div>
        {selectedFarm && (
          <p style={{ fontSize: '12px', color: '#666', margin: '10px 0 0', lineHeight: 1.6 }}>
            📍 {selectedFarm.location}<br />
            🌱 Crop: {selectedFarm.currentCrop || <span style={{ color: '#34d399' }}>not set — the report will suggest what to grow</span>}
            {' · '}🧪 {tests.length} saved test{tests.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {tests.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '44px 24px' }}>
          <div style={{ fontSize: '30px', marginBottom: '10px' }}>🧪</div>
          <h3 style={{ color: '#fff', fontSize: '16px', margin: '0 0 8px' }}>
            No soil test yet for {selectedFarm?.name}
          </h3>
          <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.6 }}>
            Take a reading with your meter first. The report is built from that test,
            this farm's history and the weather here.
          </p>
          <Link to="/soil" style={{
            display: 'inline-block', padding: '10px 22px',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
          }}>Go to Soil Test</Link>
        </div>
      ) : (
        <SoilAnalysis user={user} farm={selectedFarm} tests={tests} autoRunKey={null} />
      )}
    </div>
  );
}
