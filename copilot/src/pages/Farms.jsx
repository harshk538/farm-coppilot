import { useState, useEffect } from 'react';
import axios from 'axios';
import LocationField from '../components/LocationField';
import { API_BASE_URL } from '../config';

const API_BASE = `${API_BASE_URL}/api/farms`;

// Suggestions only — the farmer can type any crop that is not on this list.
const COMMON_CROPS = [
  'Rice (Paddy)', 'Wheat', 'Maize', 'Ragi', 'Jowar', 'Bajra',
  'Sugarcane', 'Cotton', 'Groundnut', 'Soybean', 'Mustard', 'Sunflower',
  'Tomato', 'Onion', 'Potato', 'Brinjal', 'Chilli', 'Cabbage', 'Cauliflower',
  'Banana', 'Mango', 'Grapes', 'Coconut', 'Areca Nut', 'Coffee',
  'Turmeric', 'Ginger', 'Chickpea (Gram)', 'Pigeon Pea (Tur)', 'Green Gram (Moong)',
];

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
  fontSize: '11px',
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '6px',
  display: 'block',
};

const emptyForm = { name: '', location: '', coords: null, currentCrop: '' };

export default function Farms({ user, onLogin }) {
  const [farms, setFarms] = useState([]);
  const [maxFarms, setMaxFarms] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);   // null = adding a new farm
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const loadFarms = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const res = await axios.get(API_BASE, { params: { farmerId: user.id } });
      if (res.data.success) {
        setFarms(res.data.farms);
        setMaxFarms(res.data.maxFarms || 10);
      }
    } catch {
      setError('Could not load your farms. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFarms(); /* eslint-disable-next-line */ }, [user?.id]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, name: `Farm ${farms.length + 1}` });
    setError('');
    setShowModal(true);
  };

  const openEdit = (farm) => {
    setEditingId(farm.id);
    setForm({
      name: farm.name || '',
      location: farm.location || '',
      coords: farm.coords || null,
      currentCrop: farm.currentCrop || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.location.trim()) { setError('Please enter the farm location.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        farmerId: user.id,
        name: form.name,
        location: form.location,
        coords: form.coords,
        currentCrop: form.currentCrop,
      };
      const res = editingId
        ? await axios.patch(`${API_BASE}/${editingId}`, payload)
        : await axios.post(API_BASE, payload);

      if (res.data.success) {
        setShowModal(false);
        setNotice(editingId ? 'Farm updated.' : 'Farm added.');
        setTimeout(() => setNotice(''), 3000);
        loadFarms();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this farm.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (farmId) => {
    try {
      await axios.delete(`${API_BASE}/${farmId}`, { params: { farmerId: user.id } });
      setConfirmDeleteId(null);
      setNotice('Farm removed.');
      setTimeout(() => setNotice(''), 3000);
      loadFarms();
    } catch {
      setError('Could not remove this farm.');
    }
  };

  // ── Logged out ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌾</div>
        <h3 style={{ color: '#fff', fontSize: '17px', margin: '0 0 8px' }}>Log in to manage your farms</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          Each farm keeps its own location, crop and soil history.
        </p>
        <button
          onClick={onLogin}
          style={{
            padding: '10px 22px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Log in
        </button>
      </div>
    );
  }

  if (loading) {
    return <p style={{ color: '#666', fontSize: '14px' }}>Loading your farms…</p>;
  }

  return (
    <div>
      {notice && (
        <div style={{
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '10px', padding: '10px 14px', color: '#34d399',
          fontSize: '13px', marginBottom: '16px',
        }}>
          {notice}
        </div>
      )}

      {error && !showModal && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px', padding: '10px 14px', color: '#f87171',
          fontSize: '13px', marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px', marginBottom: '18px',
      }}>
        <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
          {farms.length} of {maxFarms} farms added
        </p>
        {farms.length < maxFarms && (
          <button
            onClick={openAdd}
            style={{
              padding: '9px 18px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none', borderRadius: '10px', color: '#fff',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Add Farm
          </button>
        )}
      </div>

      {/* Farm cards */}
      {farms.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🌱</div>
          <p style={{ color: '#888', fontSize: '14px', margin: '0 0 4px' }}>No farms yet.</p>
          <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>
            Add your first farm to start recording soil tests for it.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {farms.map((farm) => (
            <div key={farm.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: '0 0 4px' }}>
                    🌾 {farm.name}
                  </h3>
                  <p style={{ color: '#888', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                    📍 {farm.location}
                  </p>
                </div>
                {farm.coords ? (
                  <span style={{
                    flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#34d399',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '100px', padding: '3px 9px',
                  }}>
                    Located
                  </span>
                ) : (
                  <span style={{
                    flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#fbbf24',
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: '100px', padding: '3px 9px',
                  }}>
                    No coordinates
                  </span>
                )}
              </div>

              <div style={{
                marginTop: '14px', paddingTop: '14px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
              }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Current Crop
                  </span>
                  <p style={{ color: farm.currentCrop ? '#eee' : '#666', fontSize: '13px', fontWeight: 600, margin: '2px 0 0' }}>
                    {farm.currentCrop || 'Not set'}
                  </p>
                </div>
                {farm.cropHistory?.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    {farm.cropHistory.length} past crop{farm.cropHistory.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button
                  onClick={() => openEdit(farm)}
                  style={{
                    flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                    color: '#ccc', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                {confirmDeleteId === farm.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(farm.id)}
                      style={{
                        flex: 1, padding: '8px', background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px',
                        color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        padding: '8px 12px', background: 'none',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                        color: '#888', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(farm.id)}
                    style={{
                      padding: '8px 14px', background: 'none',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                      color: '#888', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1000, width: '92%', maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto',
            background: '#111113', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
                {editingId ? 'Edit Farm' : 'Add a Farm'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#555', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
              >×</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Farm Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Farm 2, North Field"
                  style={inputStyle}
                />
              </div>

              <LocationField
                value={form.location}
                coords={form.coords}
                onChange={({ address, coords }) => setForm(prev => ({ ...prev, location: address, coords }))}
                inputStyle={inputStyle}
                labelStyle={labelStyle}
              />

              <div>
                <label style={labelStyle}>Current Crop</label>
                <input
                  type="text"
                  list="crop-suggestions"
                  value={form.currentCrop}
                  onChange={(e) => setForm(prev => ({ ...prev, currentCrop: e.target.value }))}
                  placeholder="What are you growing here?"
                  style={inputStyle}
                />
                <datalist id="crop-suggestions">
                  {COMMON_CROPS.map(c => <option key={c} value={c} />)}
                </datalist>
                <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                  Changing the crop later keeps the old one in this farm's crop history.
                </p>
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '12px',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%', padding: '12px',
                  background: saving ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '⏳ Saving…' : (editingId ? 'Save Changes' : 'Add Farm')}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
