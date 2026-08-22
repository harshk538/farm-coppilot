import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import { API_BASE_URL } from './config';

const API_BASE = `${API_BASE_URL}/api/vendor`;
const EQUIP_API = `${API_BASE_URL}/api/equipment`;

const DEFAULT_SHOPS = [
  { id: 'SHOP-001', name: 'Shree Agro Suppliers', location: 'Kumbalgodu, Bengaluru', phone: '+91 98765 43210', license: 'AG-KA-88219' },
  { id: 'SHOP-002', name: 'Sri Chamundeshwari Fertilizers', location: 'Kengeri, Bengaluru', phone: '+91 99887 76655', license: 'AG-KA-99120' },
  { id: 'SHOP-003', name: 'Hassan Agro Bio Tech', location: 'Bannerghatta, Bengaluru', phone: '+91 97766 55443', license: 'AG-KA-77312' },
  { id: 'SHOP-004', name: 'Venkateshwara Krishi Kendra', location: 'Tavarekere, Bengaluru', phone: '+91 96655 44332', license: 'AG-KA-66415' }
];

/* ── Navbar with Store Switcher Dropdown ────────────────────────── */
function VendorNavbar({ pendingCount, pendingEquipCount, shops, activeShop, onSelectShop }) {
  return (
    <header className="vendor-header">
      <div className="flex items-center gap-6">
        <Link to="/" className="vendor-logo">
          <span className="text-xl">🏬</span>
          <div>
            <span>AgriVendor Pro</span>
            <span className="block text-[10px] font-normal text-purple-400">Merchant Portal</span>
          </div>
        </Link>

        <nav className="flex items-center gap-1 ml-6">
          <NavLink to="/" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Incoming Orders</span>
            {pendingCount > 0 && <span className="vendor-nav-badge">{pendingCount}</span>}
          </NavLink>

          <NavLink to="/equipment-rentals" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Equipment Rentals</span>
            {pendingEquipCount > 0 && <span className="vendor-nav-badge">{pendingEquipCount}</span>}
          </NavLink>

          <NavLink to="/fleet" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Fleet & Owners</span>
          </NavLink>

          <NavLink to="/inventory" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Inventory & Stock</span>
          </NavLink>

          <NavLink to="/analytics" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Sales Analytics</span>
          </NavLink>
        </nav>
      </div>

      {/* Top Right Store Switcher Selector */}
      <div className="flex items-center gap-3">
        <div className="bg-zinc-900 border border-purple-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-left">
            <label className="block text-[9px] uppercase tracking-wider text-purple-400 font-bold">Active Store Context</label>
            <select
              value={activeShop.id}
              onChange={(e) => {
                const found = shops.find(s => s.id === e.target.value);
                if (found) onSelectShop(found);
              }}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer border-none"
            >
              {shops.map(s => (
                <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                  {s.name} ({s.location.split(',')[0]})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ── Incoming Orders Page ───────────────────────────── */
function OrdersPage({ orders, products, activeShop, onStatusUpdate, loading, claimToast }) {
  const [filter, setFilter] = useState('all');

  const isOrderOutOfStock = (orderItems) => {
    if (!orderItems || !products) return false;
    return orderItems.some(item => {
      const prod = products.find(p => 
        p.id === item.id || 
        (p.name && item.name && p.name.toLowerCase() === item.name.toLowerCase())
      );
      return prod && prod.inStock === false;
    });
  };

  const storeIsolatedOrders = orders.filter(o => {
    if (o.status === 'pending') return true;
    if (o.claimedByShopId === activeShop.id) return true;
    return false;
  });

  const filteredOrders = storeIsolatedOrders.filter(o => {
    if (filter === 'all') return true;
    return o.status === filter;
  });

  return (
    <div className="space-y-6">
      {claimToast && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold animate-fade-up">
          {claimToast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Farmer Broadcast Requests</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Logged in as: <strong className="text-purple-400">{activeShop.name}</strong> · Live chemical stock broadcast feed
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
          {['all', 'pending', 'confirmed', 'ready', 'rejected'].map(st => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === st 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="vendor-glass-card text-center py-12 text-zinc-500">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="vendor-glass-card text-center py-12 text-zinc-500">
          No chemical orders active for {activeShop.name} matching status "{filter}".
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredOrders.map(order => {
            const isClaimedByMe = order.claimedByShopId === activeShop.id;
            const hasOutOfStockItems = isOrderOutOfStock(order.items);

            return (
              <div key={order.id} className="vendor-glass-card space-y-4 animate-slide-up relative">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-purple-400 font-semibold">{order.id}</span>
                    
                    <span className={`status-badge ${hasOutOfStockItems && order.status === 'pending' ? 'rejected' : order.status}`}>
                      {order.status === 'pending' && (hasOutOfStockItems ? 'OUT OF STOCK IN INVENTORY' : 'PENDING BROADCAST')}
                      {order.status === 'confirmed' && (isClaimedByMe ? 'CONFIRMED BY YOU' : `CONFIRMED BY ${order.claimedByShopName}`)}
                      {order.status === 'ready' && 'READY FOR PICKUP'}
                      {order.status === 'rejected' && 'OUT OF STOCK'}
                    </span>
                  </div>

                  <span className="text-[11px] text-zinc-500">
                    {new Date(order.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Farmer: {order.farmerName}</span>
                    <a href={`tel:${order.farmerPhone}`} className="text-xs text-emerald-400 font-medium hover:underline">
                      Call: {order.farmerPhone}
                    </a>
                  </div>
                  <p className="text-xs text-zinc-400">Location: {order.location}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider">Requested Items:</span>
                  <div className="space-y-1.5">
                    {order.items.map((item, idx) => {
                      const itemProd = products ? products.find(p => p.id === item.id || (p.name && item.name && p.name.toLowerCase() === item.name.toLowerCase())) : null;
                      const itemOutOfStock = itemProd && itemProd.inStock === false;

                      return (
                        <div key={idx} className="flex items-center justify-between text-xs bg-zinc-900/40 px-3 py-2 rounded-lg border border-white/5">
                          <div>
                            <span className="text-white font-medium">{item.name}</span>
                            <span className="text-[10px] text-zinc-500 block">{item.category}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-emerald-400 font-semibold">₹{item.price}</span>
                            <span className="text-[11px] text-zinc-400 block">x{item.qty || 1}</span>
                            {itemOutOfStock && (
                              <span className="text-[10px] text-rose-400 font-bold block mt-0.5">OUT OF STOCK IN STORE</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-zinc-500 block">Total Value:</span>
                    <span className="text-base font-bold text-white">₹{order.totalAmount}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.status === 'pending' && (
                      hasOutOfStockItems ? (
                        <span className="text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-500/40 px-3 py-1.5 rounded-xl uppercase tracking-wider">
                          OUT OF STOCK
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => onStatusUpdate(order.id, 'confirmed')}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
                          >
                            Confirm & Claim Order
                          </button>
                          <button
                            onClick={() => onStatusUpdate(order.id, 'rejected')}
                            className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                          >
                            Out of Stock
                          </button>
                        </>
                      )
                    )}

                    {order.status === 'confirmed' && isClaimedByMe && (
                      <button
                        onClick={() => onStatusUpdate(order.id, 'ready')}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
                      >
                        Mark Ready for Pickup
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Equipment Rentals Page ────────────────────────── */
function EquipmentRentalsPage({ activeShop, owners }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [sendingQuote, setSendingQuote] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const fetchEquipRequests = async () => {
    try {
      const res = await axios.get(`${EQUIP_API}/requests`);
      if (res.data.success) setRequests(res.data.data);
    } catch (err) {
      console.error("Error fetching equipment requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipRequests();
    const interval = setInterval(fetchEquipRequests, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSendQuote = async () => {
    if (!selectedReq || !selectedOwnerId) return;
    setSendingQuote(true);

    try {
      const res = await axios.post(`${EQUIP_API}/requests/${selectedReq.id}/quote`, {
        shopId: activeShop.id,
        shopName: activeShop.name,
        shopPhone: activeShop.phone,
        ownerId: selectedOwnerId
      });

      if (res.data.success) {
        setToastMsg(`Quote dispatched to farmer for ${selectedReq.equipmentTypeName}!`);
        setTimeout(() => setToastMsg(null), 4000);
        setSelectedReq(null);
        setSelectedOwnerId('');
        fetchEquipRequests();
      }
    } catch (err) {
      console.error("Failed to send quote:", err);
    } finally {
      setSendingQuote(false);
    }
  };

  const shopOwners = owners.filter(o => o.shopId === activeShop.id && o.available);

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold animate-fade-up">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Equipment Rental Requests</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Logged in as: <strong className="text-purple-400">{activeShop.name}</strong> · Assign machine owners and dispatch quotes to farmers
          </p>
        </div>
      </div>

      {loading ? (
        <div className="vendor-glass-card text-center py-12 text-zinc-500">
          Loading equipment requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="vendor-glass-card text-center py-12 text-zinc-500">
          No equipment rental requests in area.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map(req => {
            const hasMyQuote = (req.quotes || []).some(q => q.shopId === activeShop.id);
            const isBookedWithMe = req.status === 'booked' && req.acceptedQuote && req.acceptedQuote.shopId === activeShop.id;

            return (
              <div key={req.id} className="vendor-glass-card space-y-4 relative">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="font-mono text-xs text-purple-400 font-semibold">{req.id}</span>
                  <span className={`status-badge ${isBookedWithMe ? 'ready' : (hasMyQuote ? 'confirmed' : 'pending')}`}>
                    {isBookedWithMe ? 'BOOKED WITH YOUR FLEET' : (hasMyQuote ? 'QUOTE DISPATCHED' : 'PENDING QUOTES')}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Farmer: {req.farmerName}</span>
                    <a href={`tel:${req.farmerPhone}`} className="text-xs text-emerald-400 font-medium hover:underline">
                      Call: {req.farmerPhone}
                    </a>
                  </div>
                  <p className="text-xs text-zinc-400">Location: {req.location}</p>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-300">
                  <div>Equipment: <strong className="text-white">{req.equipmentTypeName}</strong></div>
                  <div>Work: <strong className="text-white">{req.workType}</strong> ({req.landAreaAcres} Acres)</div>
                  <div>Required: <strong className="text-white">{req.requiredDate} ({req.preferredTime})</strong></div>
                </div>

                <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {(req.quotes || []).length} quotes received by farmer
                  </span>

                  <button
                    onClick={() => {
                      setSelectedReq(req);
                      setSelectedOwnerId(shopOwners[0]?.id || '');
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
                  >
                    {hasMyQuote ? 'Update Quote / Machine' : 'Assign Machine & Quote'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quote Dispatch Modal */}
      {selectedReq && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Assign Machine for Request #{selectedReq.id}</h3>
              <button onClick={() => setSelectedReq(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                <div className="text-white font-semibold">{selectedReq.equipmentTypeName} — {selectedReq.workType}</div>
                <div className="text-zinc-400">Land Area: {selectedReq.landAreaAcres} Acres · Location: {selectedReq.location}</div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Select Available Equipment Owner in Your Network:</label>
                {shopOwners.length === 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs">
                    No available machine owners registered under {activeShop.name}. Please register an owner in <strong>Fleet & Owners</strong> tab.
                  </div>
                ) : (
                  <select
                    value={selectedOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white p-2.5 rounded-xl outline-none"
                  >
                    {shopOwners.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.ownerName} — {o.machineName} ({o.rating}★)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Automatic Price & Revenue Split Preview */}
              <div className="bg-purple-950/40 border border-purple-500/30 p-3 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-sm font-bold text-white">
                  <span>Calculated Quote Price:</span>
                  <span className="text-emerald-400">₹{selectedReq.landAreaAcres * 500}</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Owner Payout (90%): ₹{Math.round(selectedReq.landAreaAcres * 500 * 0.9)}</span>
                  <span>Vendor Commission (10%): ₹{Math.round(selectedReq.landAreaAcres * 500 * 0.1)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedReq(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={!selectedOwnerId || sendingQuote}
                onClick={handleSendQuote}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg cursor-pointer"
              >
                {sendingQuote ? 'Dispatching...' : 'Dispatch Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Fleet & Owners Page ──────────────────────────── */
function FleetPage({ activeShop, owners, onAddOwner, onToggleOwnerStatus }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: '',
    ownerPhone: '',
    machineType: 'EQ-TRAC',
    machineName: '',
    location: activeShop.location
  });

  const shopOwners = owners.filter(o => o.shopId === activeShop.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddOwner({
      ...formData,
      shopId: activeShop.id,
      shopName: activeShop.name
    });
    setShowAddModal(false);
    setFormData({ ownerName: '', ownerPhone: '', machineType: 'EQ-TRAC', machineName: '', location: activeShop.location });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Fleet & Machine Owners Directory</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Registered equipment owners under <strong className="text-purple-400">{activeShop.name}</strong>
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg cursor-pointer"
        >
          + Register Machine Owner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shopOwners.length === 0 ? (
          <div className="col-span-3 vendor-glass-card text-center py-12 text-zinc-500">
            No machine owners registered under {activeShop.name} yet. Click "+ Register Machine Owner" to add one!
          </div>
        ) : (
          shopOwners.map(o => (
            <div key={o.id} className="vendor-glass-card space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/20">
                    {o.id}
                  </span>
                  <span className="text-xs font-semibold text-amber-400">{o.rating || 4.8} ★</span>
                </div>

                <h3 className="text-sm font-bold text-white">{o.machineName}</h3>
                <p className="text-xs text-zinc-300 font-semibold mt-1">Owner: {o.ownerName}</p>
                <p className="text-xs text-zinc-400">Phone: {o.ownerPhone}</p>
                <p className="text-xs text-zinc-500">Location: {o.location}</p>
              </div>

              <div className="border-t border-white/5 pt-3 flex items-center justify-between mt-3">
                <span className="text-xs font-medium text-zinc-300">
                  {o.available ? '🟢 Available for Rent' : '🔴 Busy / In Use'}
                </span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={o.available !== false}
                    onChange={(e) => onToggleOwnerStatus(o.id, e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Owner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Register Equipment Owner</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1">Owner Name (Farmer)</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                placeholder="e.g. Ramesh Gowda"
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1">Owner Phone Number</label>
              <input
                type="text"
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                placeholder="+91 98765 00000"
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1">Machine Name & Model</label>
              <input
                type="text"
                value={formData.machineName}
                onChange={(e) => setFormData({ ...formData, machineName: e.target.value })}
                placeholder="e.g. Mahindra 575 DI Tractor (45 HP)"
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-lg"
              >
                Save Owner
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ── Inventory Page ────────────────────────── */
function InventoryPage({ products, activeShop, onStockToggle }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.activeIngredient || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Product Inventory</h1>
          <p className="text-xs text-zinc-400 mt-1">Managing stock for {activeShop.name}</p>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products by chemical name..."
          className="bg-zinc-900 border border-zinc-800 text-white text-xs rounded-xl px-4 py-2 w-72 focus:outline-none focus:border-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredProducts.map(p => (
          <div key={p.id} className="vendor-glass-card space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/20">
                  {p.category}
                </span>
                <span className="text-xs font-mono text-zinc-500">{p.id}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{p.name}</h3>
              <p className="text-xs text-zinc-400 italic mt-0.5">{p.activeIngredient}</p>
              <p className="text-xs text-zinc-300 font-semibold mt-2">₹{p.price}</p>
            </div>

            <div className="border-t border-white/5 pt-3 flex items-center justify-between mt-3">
              <span className="text-xs font-medium text-zinc-300">
                {p.inStock !== false ? 'In Stock' : 'Out of Stock'}
              </span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={p.inStock !== false}
                  onChange={(e) => onStockToggle(p.id, e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Analytics Page ────────────────────────── */
function AnalyticsPage({ stats, activeShop }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Sales & Fulfillment Analytics</h1>
        <p className="text-xs text-zinc-400 mt-1">Merchant business metrics for {activeShop.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="vendor-glass-card space-y-2 border-l-4 border-l-purple-500">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Sales Revenue</span>
          <div className="text-3xl font-bold text-white">₹{stats.totalRevenue || 0}</div>
          <span className="text-[11px] text-emerald-400">18% increase from last week</span>
        </div>

        <div className="vendor-glass-card space-y-2 border-l-4 border-l-emerald-500">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Confirmed Claims</span>
          <div className="text-3xl font-bold text-white">{stats.confirmedOrders || 0}</div>
          <span className="text-[11px] text-zinc-400">Successful order fulfillments</span>
        </div>

        <div className="vendor-glass-card space-y-2 border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pending Broadcast Requests</span>
          <div className="text-3xl font-bold text-white">{stats.pendingOrders || 0}</div>
          <span className="text-[11px] text-amber-400">Available for claim</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Vendor App ───────────────────────── */
export default function App() {
  const [shops, setShops] = useState(DEFAULT_SHOPS);
  const [activeShop, setActiveShop] = useState(DEFAULT_SHOPS[0]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [owners, setOwners] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [claimToast, setClaimToast] = useState(null);

  const loadShops = async () => {
    try {
      const res = await axios.get(`${API_BASE}/shops`);
      if (res.data.success && res.data.data.length > 0) {
        setShops(res.data.data);
      }
    } catch (e) {}
  };

  const loadVendorData = async () => {
    try {
      const [ordRes, prodRes, statRes, ownRes] = await Promise.all([
        axios.get(`${API_BASE}/orders`),
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/stats?shopId=${activeShop.id}`),
        axios.get(`${EQUIP_API}/owners?shopId=${activeShop.id}`)
      ]);
      if (ordRes.data.success) setOrders(ordRes.data.data);
      if (prodRes.data.success) setProducts(prodRes.data.data);
      if (statRes.data.success) setStats(statRes.data.data);
      if (ownRes.data.success) setOwners(ownRes.data.data);
    } catch (err) {
      console.error("Vendor fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    loadVendorData();
    const interval = setInterval(loadVendorData, 3000);
    return () => clearInterval(interval);
  }, [activeShop]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const res = await axios.patch(`${API_BASE}/orders/${orderId}/status`, {
        status: newStatus,
        shopId: activeShop.id,
        shopName: activeShop.name,
        shopPhone: activeShop.phone
      });

      if (res.data.alreadyClaimed) {
        setClaimToast(`Order already claimed by ${res.data.claimedByShopName}`);
        setTimeout(() => setClaimToast(null), 4000);
      }

      loadVendorData();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setClaimToast(err.response.data.message);
        setTimeout(() => setClaimToast(null), 4000);
      }
      console.error("Failed to update status:", err);
    }
  };

  const handleStockToggle = async (productId, inStock) => {
    try {
      await axios.patch(`${API_BASE}/products/${productId}/stock`, { inStock });
      loadVendorData();
    } catch (err) {
      console.error("Failed to toggle stock:", err);
    }
  };

  const handleAddOwner = async (newOwnerData) => {
    try {
      await axios.post(`${EQUIP_API}/owners`, newOwnerData);
      loadVendorData();
    } catch (err) {
      console.error("Failed to add owner:", err);
    }
  };

  const handleToggleOwnerStatus = async (ownerId, available) => {
    try {
      await axios.patch(`${EQUIP_API}/owners/${ownerId}/status`, { available });
      loadVendorData();
    } catch (err) {
      console.error("Failed to toggle owner status:", err);
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0c] text-white">
        <div className="vendor-orb vendor-orb-1" />
        <div className="vendor-orb vendor-orb-2" />

        <VendorNavbar
          pendingCount={pendingCount}
          pendingEquipCount={1}
          shops={shops}
          activeShop={activeShop}
          onSelectShop={(s) => setActiveShop(s)}
        />

        <main className="pt-24 pb-16 max-w-6xl mx-auto px-6 relative z-10">
          <Routes>
            <Route path="/" element={
              <OrdersPage
                orders={orders}
                products={products}
                activeShop={activeShop}
                onStatusUpdate={handleStatusUpdate}
                loading={loading}
                claimToast={claimToast}
              />
            } />
            <Route path="/equipment-rentals" element={
              <EquipmentRentalsPage
                activeShop={activeShop}
                owners={owners}
              />
            } />
            <Route path="/fleet" element={
              <FleetPage
                activeShop={activeShop}
                owners={owners}
                onAddOwner={handleAddOwner}
                onToggleOwnerStatus={handleToggleOwnerStatus}
              />
            } />
            <Route path="/inventory" element={
              <InventoryPage
                products={products}
                activeShop={activeShop}
                onStockToggle={handleStockToggle}
              />
            } />
            <Route path="/analytics" element={
              <AnalyticsPage
                stats={stats}
                activeShop={activeShop}
              />
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
