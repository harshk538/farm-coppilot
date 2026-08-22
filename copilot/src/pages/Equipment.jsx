import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const API_BASE = `${API_BASE_URL}/api/equipment`;

export default function Equipment() {
  const [activeTab, setActiveTab] = useState('renter'); // 'renter' | 'owner'
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [allOwners, setAllOwners] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState(null);

  // Form State for Renters
  const [formData, setFormData] = useState({
    farmerName: 'Rahul Patel',
    farmerPhone: '+91 98765 99887',
    location: 'Kaggalipura, Bengaluru',
    equipmentTypeId: 'EQ-TRAC',
    workType: 'Ploughing & Land Prep',
    landAreaAcres: 3,
    requiredDate: 'Tomorrow',
    preferredTime: '08:00 AM - 02:00 PM'
  });

  useEffect(() => {
    axios.get(`${API_BASE}/types`).then(res => {
      if (res.data.success) setEquipmentTypes(res.data.data);
    }).catch(err => console.error("Error loading types:", err));

    axios.get(`${API_BASE}/owners`).then(res => {
      if (res.data.success) {
        setAllOwners(res.data.data);
        if (res.data.data.length > 0) setSelectedOwnerId(res.data.data[0].id);
      }
    }).catch(err => console.error("Error loading owners:", err));
  }, []);

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
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/requests`, formData);
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

  const handleOwnerAcceptPing = async (requestId) => {
    if (!selectedOwnerId) return;
    try {
      const res = await axios.post(`${API_BASE}/requests/${requestId}/owner-accept`, { ownerId: selectedOwnerId });
      if (res.data.success) {
        setNoticeMsg(`Job Accepted! Your quote was dispatched to the farmer via your registered vendor network.`);
        setTimeout(() => setNoticeMsg(null), 4000);
        fetchRequests();
      }
    } catch (err) {
      console.error("Failed to accept job ping:", err);
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
  const estimatedCost = (formData.landAreaAcres || 1) * (selectedType.defaultRate || 500);
  const activeOwnerObj = allOwners.find(o => o.id === selectedOwnerId);

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
                  onChange={e => setFormData({ ...formData, equipmentTypeId: e.target.value })}
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
                <input
                  type="text"
                  value={formData.workType}
                  onChange={e => setFormData({ ...formData, workType: e.target.value })}
                  placeholder="e.g. Ploughing, Harvesting"
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
                  Required Date & Time
                </label>
                <input
                  type="text"
                  value={formData.requiredDate}
                  onChange={e => setFormData({ ...formData, requiredDate: e.target.value })}
                  placeholder="Tomorrow (08 AM - 02 PM)"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#888' }}>Estimated Fixed Cost:</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>
                    ₹{estimatedCost} <span style={{ fontSize: '12px', color: '#888', fontWeight: 400 }}>({formData.landAreaAcres} acres × ₹{selectedType.defaultRate}/acre)</span>
                  </div>
                </div>

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
                    <span>Required: <strong style={{ color: '#fff' }}>{req.requiredDate}</strong></span>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
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
          
          {/* Active Owner Profile Selector */}
          <div style={{ backgroundColor: 'rgba(20,20,26,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', display: 'block' }}>Active Owner Profile</label>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                style={{ backgroundColor: '#121216', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginTop: '4px', outline: 'none' }}
              >
                {allOwners.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.ownerName} — {o.machineName} ({o.shopName})
                  </option>
                ))}
              </select>
            </div>

            {activeOwnerObj && (
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#a1a1aa' }}>
                <div>Machine: <strong style={{ color: '#fff' }}>{activeOwnerObj.machineName}</strong></div>
                <div>Status: <span style={{ color: '#34d399', fontWeight: 600 }}>🟢 Available for Job Pings</span></div>
              </div>
            )}
          </div>

          {/* Incoming Job Pings List */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
              🔔 Live Job Pings in Your Area
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {requests.filter(r => r.status !== 'booked').length === 0 ? (
                <div style={{ padding: '30px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '14px', color: '#666', textAlign: 'center' }}>
                  No active job pings right now. New requests from nearby farmers will appear here live!
                </div>
              ) : (
                requests.filter(r => r.status !== 'booked').map(req => {
                  const hasAlreadyAccepted = (req.quotes || []).some(q => q.ownerId === selectedOwnerId);
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
                          <button
                            onClick={() => handleOwnerAcceptPing(req.id)}
                            style={{
                              backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px',
                              padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: '6px',
                              boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                            }}
                          >
                            Accept Job Ping
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
