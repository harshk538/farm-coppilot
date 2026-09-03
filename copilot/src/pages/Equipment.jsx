import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import LocationField from '../components/LocationField';
import { API_BASE_URL } from '../config';

const API_BASE = `${API_BASE_URL}/api/equipment`;

// Work types available per equipment, so the dropdown matches what the machine can actually do
const WORK_TYPES_BY_EQUIPMENT = {
  'EQ-TRAC': ['Ploughing & Land Prep', 'Tilling', 'Land Leveling', 'Hauling & Transport'],
  'EQ-HARV': ['Paddy Harvesting', 'Wheat Harvesting', 'Maize Harvesting', 'Threshing'],
  'EQ-ROTA': ['Soil Preparation', 'Seedbed Preparation', 'Stubble Mixing'],
  'EQ-PUMP': ['Field Irrigation', 'Water Transfer', 'Drainage'],
  'EQ-SEED': ['Seed Sowing', 'Fertilizer Placement', 'Precision Planting'],
  'EQ-SPRAY': ['Pesticide Spraying', 'Fertilizer Spraying', 'Biostimulant Spraying'],
  'EQ-TRANS': ['Produce Transport to Mandi', 'Storage Transport', 'Farm-to-Farm Transport'],
};
const DEFAULT_WORK_TYPES = ['General Farm Work'];

// "I Own Machinery" job pings only reach owners within this radius (km) of the job —
// this is what keeps it different from the vendor-mediated Rent Equipment flow.
const OWNER_JOB_RADIUS_KM = 7;

// Straight-line distance between two {lat,lng} points, in kilometers.
function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Presets for the "Register as Machine Owner" form's Machine Name & Model field
const MACHINE_PRESETS = [
  { name: 'Mahindra 575 DI Tractor (45 HP)', type: 'EQ-TRAC' },
  { name: 'Sonalika DI 745 III (50 HP)', type: 'EQ-TRAC' },
  { name: 'Swaraj 744 FE Tractor (48 HP)', type: 'EQ-TRAC' },
  { name: 'Shaktiman Rotary Tiller 7ft', type: 'EQ-ROTA' },
  { name: 'Fieldking Rotavator 6ft', type: 'EQ-ROTA' },
  { name: 'Kubota DC-68G Combine Harvester', type: 'EQ-HARV' },
  { name: 'Preet 987 Combine Harvester', type: 'EQ-HARV' },
  { name: 'Kirloskar 5HP Heavy Diesel Water Pump', type: 'EQ-PUMP' },
  { name: 'Crompton 3HP Submersible Pump', type: 'EQ-PUMP' }
];

// Turns a native <input type="date"> value (YYYY-MM-DD) into a friendly label, e.g. "26 Aug 2026"
function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Turns a native <input type="time"> value (24hr HH:MM) into 12hr label, e.g. "08:00 AM"
function formatTimeLabel(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

// Tomorrow's date as the default, in the format the native date input needs
function getDefaultIsoDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Equipment({ user, onLogin }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('renter'); // 'renter' | 'owner'
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [allOwners, setAllOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState(null);

  // "Register as Machine Owner" (I Own Machinery — direct farmer network)
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerForm, setRegisterForm] = useState({ machineType: 'EQ-TRAC', machineName: '', location: '', coords: null, biddingPrice: '' });

  // Form State for Renters
  const [formData, setFormData] = useState({
    // farmerName/farmerPhone are no longer sourced from here — handleSubmitRequest
    // always overrides them with the logged-in user's real name/phone.
    location: 'Kaggalipura, Bengaluru',
    equipmentTypeId: 'EQ-TRAC',
    workType: 'Ploughing & Land Prep',
    landAreaAcres: 3,
    requiredDateRaw: getDefaultIsoDate(),
    requiredTimeRaw: '08:00',
    requiredDate: formatDateLabel(getDefaultIsoDate()),
    preferredTime: formatTimeLabel('08:00')
  });

  useEffect(() => {
    axios.get(`${API_BASE}/types`).then(res => {
      if (res.data.success) setEquipmentTypes(res.data.data);
    }).catch(err => console.error("Error loading types:", err));

    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      const res = await axios.get(`${API_BASE}/owners`);
      if (res.data.success) setAllOwners(res.data.data);
    } catch (err) {
      console.error("Error loading owners:", err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_BASE}/requests`);
      if (res.data.success) setRequests(res.data.data);
    } catch (err) {
      console.error("Error fetching requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!user) {
      if (onLogin) onLogin();
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/requests`, {
        ...formData,
        farmerName: user.name,
        farmerPhone: user.phone,
      });
      if (res.data.success) {
        setNoticeMsg(`Rental Request #${res.data.data.id} broadcasted to nearby equipment owners!`);
        setTimeout(() => setNoticeMsg(null), 4000);
        fetchRequests();
      }
    } catch (err) {
      console.error("Failed to submit request:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptQuote = async (requestId, quoteId) => {
    try {
      const res = await axios.post(`${API_BASE}/requests/${requestId}/accept`, { quoteId });
      if (res.data.success) {
        setNoticeMsg(`Quote accepted! Equipment booked from ${res.data.data.acceptedQuote.shopName}.`);
        setTimeout(() => setNoticeMsg(null), 4000);
        fetchRequests();
      }
    } catch (err) {
      console.error("Failed to accept quote:", err);
    }
  };

  const handleOwnerAcceptPing = async (requestId, ownerId) => {
    if (!ownerId) return;
    try {
      const res = await axios.post(`${API_BASE}/requests/${requestId}/owner-accept`, { ownerId });
      if (res.data.success) {
        setNoticeMsg(`Job Accepted! Your quote was sent directly to the farmer.`);
        setTimeout(() => setNoticeMsg(null), 4000);
        fetchRequests();
      }
    } catch (err) {
      console.error("Failed to accept job ping:", err);
    }
  };

  const handleRegisterOwner = async (e) => {
    e.preventDefault();
    if (!user) return;
    setRegistering(true);
    setRegisterError('');
    try {
      const res = await axios.post(`${API_BASE}/owners/self-register`, {
        farmerId: user.id,
        farmerName: user.name,
        farmerPhone: user.phone,
        machineType: registerForm.machineType,
        machineName: registerForm.machineName,
        location: registerForm.location,
        coords: registerForm.coords,
        biddingPrice: registerForm.biddingPrice
      });
      if (res.data.success) {
        setShowRegisterModal(false);
        setRegisterForm({ machineType: 'EQ-TRAC', machineName: '', location: '', biddingPrice: '' });
        setNoticeMsg('Your machine is registered! You will now get live job pings nearby.');
        setTimeout(() => setNoticeMsg(null), 4000);
        fetchOwners();
      }
    } catch (err) {
      setRegisterError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const handleToggleMyAvailability = async (ownerId, currentAvailable) => {
    try {
      await axios.patch(`${API_BASE}/owners/${ownerId}/status`, { available: !currentAvailable });
      fetchOwners();
    } catch (err) {
      console.error("Failed to update availability:", err);
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setNoticeMsg(`Rental Request #${requestId} cancelled.`);
      setTimeout(() => setNoticeMsg(null), 3000);

      await axios.delete(`${API_BASE}/requests/${requestId}`);
    } catch (err) {
      console.error("Failed to cancel request:", err);
      fetchRequests();
    }
  };

  const selectedType = equipmentTypes.find(t => t.id === formData.equipmentTypeId) || { defaultRate: 500, rateType: 'per_acre', icon: '🚜' };
  const myOwners = allOwners.filter(o => o.farmerId === user?.id);
  const MAX_MACHINES_PER_FARMER = 5;
  const [selectedMachineByReq, setSelectedMachineByReq] = useState({});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Notice Banner */}
      {noticeMsg && (
        <div style={{
          backgroundColor: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(16,185,129,0.4)',
          borderRadius: '12px',
          padding: '14px 18px',
          color: '#34d399',
          fontSize: '14px',
          fontWeight: 600
        }}>
          {noticeMsg}
        </div>
      )}

      {/* ── HEADER HERO WITH ROLE SWITCHER ── */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{ maxWidth: '580px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase',
            backgroundColor: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            padding: '4px 10px', borderRadius: '100px', letterSpacing: '0.5px'
          }}>
            Automated Agricultural Equipment Sharing Network
          </span>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: '8px 0 4px', letterSpacing: '-0.5px' }}>
            {activeTab === 'renter' ? 'Rent Farm Machinery' : 'Equipment Owner Earnings Hub'}
          </h1>
          <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
            {activeTab === 'renter' 
              ? 'Request tractors, harvesters, or rotavators. Requests are pinged directly to nearby machine owners.' 
              : 'Receive real-time job pings on your tractor or machine, accept bookings, and earn extra income.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: '#121216',
          padding: '4px',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={() => setActiveTab('renter')}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'renter' ? '#8b5cf6' : 'transparent',
              color: activeTab === 'renter' ? '#fff' : '#a1a1aa',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            🌾 Rent Equipment
          </button>
          <button
            onClick={() => setActiveTab('owner')}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: activeTab === 'owner' ? '#10b981' : 'transparent',
              color: activeTab === 'owner' ? '#fff' : '#a1a1aa',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            🚜 I Own Machinery (Earn)
          </button>
        </div>
      </div>

      {/* ── TAB 1: FARMER RENTER FLOW ── */}
      {activeTab === 'renter' && (
        <>
          <div style={{
            backgroundColor: 'rgba(20,20,26,0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.3px' }}>
              Request Farm Machinery
            </h2>

            <form onSubmit={handleSubmitRequest} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Equipment Required
                </label>
                <select
                  value={formData.equipmentTypeId}
                  onChange={e => {
                    const newTypeId = e.target.value;
                    const workOptions = WORK_TYPES_BY_EQUIPMENT[newTypeId] || DEFAULT_WORK_TYPES;
                    setFormData({ ...formData, equipmentTypeId: newTypeId, workType: workOptions[0] });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                >
                  {equipmentTypes.map(t => (
                    <option key={t.id} value={t.id} style={{ backgroundColor: '#121216', color: '#fff' }}>
                      {t.icon} {t.name} (₹{t.defaultRate}/{t.rateType === 'per_acre' ? 'acre' : 'hr'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Type of Work
                </label>
                <select
                  value={formData.workType}
                  onChange={e => setFormData({ ...formData, workType: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                  required
                >
                  {(WORK_TYPES_BY_EQUIPMENT[formData.equipmentTypeId] || DEFAULT_WORK_TYPES).map(w => (
                    <option key={w} value={w} style={{ backgroundColor: '#121216', color: '#fff' }}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Land Area (Acres)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.landAreaAcres}
                  onChange={e => setFormData({ ...formData, landAreaAcres: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Farm Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Required Date
                </label>
                <input
                  type="date"
                  value={formData.requiredDateRaw}
                  onChange={e => {
                    const raw = e.target.value;
                    setFormData({ ...formData, requiredDateRaw: raw, requiredDate: formatDateLabel(raw) });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '13px', outline: 'none', colorScheme: 'dark'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Required Time
                </label>
                <input
                  type="time"
                  value={formData.requiredTimeRaw}
                  onChange={e => {
                    const raw = e.target.value;
                    setFormData({ ...formData, requiredTimeRaw: raw, preferredTime: formatTimeLabel(raw) });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '13px', outline: 'none', colorScheme: 'dark'
                  }}
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '12px',
                    padding: '12px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Broadcasting Pings...' : 'Broadcast Rental Request'}
                </button>
              </div>
            </form>
          </div>

          {/* Active Requests Feed */}
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
              Your Rental Requests & Incoming Quotes
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {requests.map(req => (
                <div key={req.id} style={{
                  backgroundColor: 'rgba(20,20,26,0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#c4b5fd' }}>{req.id}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{req.equipmentTypeName} — {req.workType}</span>
                    </div>
                    <span className={`status-badge ${req.status === 'booked' ? 'ready' : 'pending'}`}>
                      {req.status === 'booked' ? 'BOOKED · DISPATCHED' : `BROADCAST ACTIVE (${(req.quotes || []).length} QUOTES)`}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#a1a1aa', display: 'flex', gap: '20px' }}>
                    <span>Area: <strong style={{ color: '#fff' }}>{req.landAreaAcres} Acres</strong></span>
                    <span>Location: <strong style={{ color: '#fff' }}>{req.location}</strong></span>
                    <span>Required: <strong style={{ color: '#fff' }}>{req.requiredDate} ({req.preferredTime})</strong></span>
                  </div>

                  {req.status === 'booked' && req.acceptedQuote && (
                    <div style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '14px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399' }}>BOOKED & DISPATCHED</span>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: '2px 0' }}>{req.acceptedQuote.machineName}</h4>
                        <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0 }}>Driver: {req.acceptedQuote.ownerName} via {req.acceptedQuote.shopName}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#34d399' }}>₹{req.acceptedQuote.calculatedPrice}</div>
                        <span style={{ fontSize: '11px', color: '#60a5fa' }}>Call: {req.acceptedQuote.shopPhone}</span>
                      </div>
                    </div>
                  )}

                  {req.status !== 'booked' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                      {(!req.quotes || req.quotes.length === 0) ? (
                        <div style={{ fontSize: '12px', color: '#666', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', textAlign: 'center' }}>
                          Pings sent to nearby equipment owners. Waiting for an owner to accept...
                        </div>
                      ) : (
                        req.quotes.map(q => (
                          <div key={q.quoteId} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{q.machineName}</div>
                              <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Owner: {q.ownerName} ({q.distanceKm})</div>
                              <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '2px' }}>Rating: {q.rating} ★</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: '#4ade80' }}>₹{q.calculatedPrice}</div>
                              <button onClick={() => handleAcceptQuote(req.id, q.quoteId)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                                Select & Book
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    {req.status === 'booked' && req.acceptedQuote && (
                      <button
                        onClick={() => navigate(
                          `/treatment?trackEquip=${req.id}&shopId=${req.acceptedQuote.shopId}` +
                          `&machine=${encodeURIComponent(req.acceptedQuote.machineName)}` +
                          `&owner=${encodeURIComponent(req.acceptedQuote.ownerName)}` +
                          `&shopName=${encodeURIComponent(req.acceptedQuote.shopName)}` +
                          `&bookedAt=${encodeURIComponent(req.bookedAt || '')}`
                        )}
                        style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Track
                      </button>
                    )}
                    <button onClick={() => handleCancelRequest(req.id)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}>
                      Cancel Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: EQUIPMENT OWNER HUB (JOB PINGS) ── */}
      {activeTab === 'owner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* My Machine — register once, then it's this farmer's own listing in the
              direct "I Own Machinery" network (no vendor involved). */}
          {!user ? (
            <div style={{ backgroundColor: 'rgba(20,20,26,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
              <p style={{ color: '#a1a1aa', fontSize: '13px', margin: '0 0 12px' }}>Log in to register your machine and start earning.</p>
              <button
                onClick={onLogin}
                style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Log In
              </button>
            </div>
          ) : myOwners.length === 0 ? (
            <div style={{ backgroundColor: 'rgba(20,20,26,0.7)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '16px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <p style={{ color: '#fff', fontSize: '14px', fontWeight: 700, margin: 0 }}>You haven't registered a machine yet</p>
                <p style={{ color: '#a1a1aa', fontSize: '12px', margin: '4px 0 0' }}>Your machine's address must be within {OWNER_JOB_RADIUS_KM} km of your field location ({user.fieldLocation || 'not set'}).</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(true)}
                style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                + Register as Machine Owner
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>My Machines ({myOwners.length}/{MAX_MACHINES_PER_FARMER})</label>
              {myOwners.map(o => (
                <div key={o.id} style={{ backgroundColor: 'rgba(20,20,26,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{o.machineName}</div>
                    <div style={{ color: '#a1a1aa', fontSize: '12px', marginTop: '2px' }}>{o.location}</div>
                  </div>
                  <button
                    onClick={() => handleToggleMyAvailability(o.id, o.available)}
                    style={{
                      backgroundColor: o.available ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      border: `1px solid ${o.available ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      color: o.available ? '#34d399' : '#f87171',
                      borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {o.available ? '🟢 Available for Job Pings' : '🔴 Marked Unavailable'}
                  </button>
                </div>
              ))}

              {myOwners.length < MAX_MACHINES_PER_FARMER ? (
                <button
                  onClick={() => setShowRegisterModal(true)}
                  style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', borderRadius: '10px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add Another Machine
                </button>
              ) : (
                <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>Maximum {MAX_MACHINES_PER_FARMER} machines reached for this account.</p>
              )}
            </div>
          )}

          {/* Incoming Job Pings List — only jobs matching this owner's machine type,
              within the 7km "I Own Machinery" radius, show up here. This is what keeps
              this network separate from the vendor-mediated Rent Equipment flow. */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
              🔔 Live Job Pings in Your Area (within {OWNER_JOB_RADIUS_KM} km)
            </h3>

            {(() => {
              // A job ping is relevant if ANY of this farmer's own machines matches
              // its type and (when we have coords on both sides) falls within the
              // 7km radius. Farmers with several machines can match on more than one.
              const getMatchingMachines = (r) => myOwners.filter(o => {
                if (o.machineType !== r.equipmentTypeId) return false;
                if (o.coords && r.coords) {
                  const distKm = haversineKm(o.coords, r.coords);
                  if (distKm !== null && distKm > OWNER_JOB_RADIUS_KM) return false;
                }
                return true;
              });

              const nearbyRequests = requests.filter(r => {
                if (r.status === 'booked') return false;
                return getMatchingMachines(r).length > 0;
              });

              if (nearbyRequests.length === 0) {
                return (
                  <div style={{ padding: '30px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', color: '#666', textAlign: 'center' }}>
                    No active job pings right now. New requests from nearby farmers will appear here live!
                  </div>
                );
              }

              return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {
                nearbyRequests.map(req => {
                  const matchingMachines = getMatchingMachines(req);
                  const hasAlreadyAccepted = (req.quotes || []).some(q => matchingMachines.some(o => o.id === q.ownerId));
                  const selectedMachineId = selectedMachineByReq[req.id] || matchingMachines[0]?.id || '';
                  const estimatedPayout = Math.round(req.landAreaAcres * 500 * 0.9);

                  return (
                    <div key={req.id} style={{
                      backgroundColor: 'rgba(20,20,26,0.8)',
                      border: hasAlreadyAccepted ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(139,92,246,0.3)',
                      borderRadius: '16px',
                      padding: '18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{ spaceY: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#8b5cf6', color: '#fff', padding: '2px 8px', borderRadius: '4px' }}>LIVE PING</span>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{req.equipmentTypeName} — {req.workType}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#a1a1aa', margin: '4px 0 0' }}>
                          Farmer: <strong>{req.farmerName}</strong> · Location: <strong>{req.location}</strong>
                        </p>
                        <p style={{ fontSize: '12px', color: '#a1a1aa', margin: '2px 0 0' }}>
                          Land Area: <strong>{req.landAreaAcres} Acres</strong> · Date: <strong>{req.requiredDate} ({req.preferredTime})</strong>
                        </p>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '160px' }}>
                        <div style={{ fontSize: '11px', color: '#888' }}>Your Net Payout (90%):</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#34d399' }}>₹{estimatedPayout}</div>

                        {hasAlreadyAccepted ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(16,185,129,0.15)', padding: '4px 10px', borderRadius: '8px', display: 'inline-block', marginTop: '6px' }}>
                            ✓ QUOTE DISPATCHED
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                            {matchingMachines.length > 1 && (
                              <select
                                value={selectedMachineId}
                                onChange={(e) => setSelectedMachineByReq(prev => ({ ...prev, [req.id]: e.target.value }))}
                                style={{ backgroundColor: '#121216', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                              >
                                {matchingMachines.map(o => (
                                  <option key={o.id} value={o.id}>{o.machineName}</option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => handleOwnerAcceptPing(req.id, selectedMachineId)}
                              style={{
                                backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px',
                                padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                              }}
                            >
                              Accept Job Ping
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              }
            </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* Register as Machine Owner Modal */}
      {showRegisterModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowRegisterModal(false)}>
          <div style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', maxWidth: '440px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>Register as Machine Owner</h2>
            <p style={{ color: '#a1a1aa', fontSize: '12px', margin: '0 0 20px' }}>
              Must be within {OWNER_JOB_RADIUS_KM} km of your field location ({user?.fieldLocation || 'not set'}).
            </p>

            <form onSubmit={handleRegisterOwner} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Pick a Preset (optional)</label>
                <select
                  onChange={(e) => {
                    const preset = MACHINE_PRESETS.find(m => m.name === e.target.value);
                    if (preset) setRegisterForm({ ...registerForm, machineName: preset.name, machineType: preset.type });
                  }}
                  style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">-- Select a common machine --</option>
                  {MACHINE_PRESETS.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Machine Name & Model</label>
                <input
                  type="text"
                  value={registerForm.machineName}
                  onChange={(e) => setRegisterForm({ ...registerForm, machineName: e.target.value })}
                  required
                  placeholder="Or type your own, e.g. Mahindra 575 DI Tractor (45 HP)"
                  style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <LocationField
                label="Address / Location"
                value={registerForm.location}
                coords={registerForm.coords}
                onChange={({ address, coords }) => setRegisterForm(prev => ({ ...prev, location: address, coords }))}
                inputStyle={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                labelStyle={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}
              />

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Bidding Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={registerForm.biddingPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setRegisterForm({ ...registerForm, biddingPrice: '' });
                    } else {
                      const num = Math.max(0, Number(val));
                      setRegisterForm({ ...registerForm, biddingPrice: num });
                    }
                  }}
                  required
                  style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>The price you charge per acre. Set it low to win more jobs.</p>
              </div>

              {registerError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '12px' }}>
                  {registerError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  style={{ flex: 1, padding: '11px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  style={{ flex: 1, padding: '11px', backgroundColor: registering ? 'rgba(16,185,129,0.4)' : '#10b981', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: registering ? 'not-allowed' : 'pointer' }}
                >
                  {registering ? 'Checking...' : 'Save Machine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
