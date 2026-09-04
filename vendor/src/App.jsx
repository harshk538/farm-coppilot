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
function VendorNavbar({ pendingCount, pendingEquipCount, deliveriesCount, shops, activeShop, onSelectShop }) {
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

          <NavLink to="/deliveries" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Deliveries</span>
            {deliveriesCount > 0 && <span className="vendor-nav-badge">{deliveriesCount}</span>}
          </NavLink>

          <NavLink to="/equipment-rentals" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Equipment Rentals</span>
            {pendingEquipCount > 0 && <span className="vendor-nav-badge">{pendingEquipCount}</span>}
          </NavLink>

          <NavLink to="/booked-jobs" className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}>
            <span>Booked Jobs</span>
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
        <div className="bg-zinc-900 border border-purple-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg w-fit max-w-[220px] shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-left min-w-0">
            <label className="block text-[9px] uppercase tracking-wider text-purple-400 font-bold">Active Store</label>
            <select
              value={activeShop.id}
              onChange={(e) => {
                const found = shops.find(s => s.id === e.target.value);
                if (found) onSelectShop(found);
              }}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer border-none max-w-[150px] truncate"
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
          {['all', 'pending', 'confirmed', 'ready', 'delivered', 'rejected'].map(st => (
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
                      {order.status === 'delivered' && '✅ DELIVERED'}
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

                {/* Delivery details — filled in by the farmer once the order is ready */}
                {(order.status === 'ready' || order.status === 'delivered') && order.delivery && (
                  <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                      📦 Delivery Details (confirmed by farmer)
                    </span>
                    <div className="text-xs text-zinc-300 leading-relaxed">
                      <strong className="text-white">{order.delivery.fullName}</strong> · {order.delivery.phone}
                      <br />
                      {order.delivery.address}
                      {order.delivery.landmark ? `, ${order.delivery.landmark}` : ''}
                      {order.delivery.pincode ? ` - ${order.delivery.pincode}` : ''}
                      <br />
                      Payment:{' '}
                      <strong className="text-emerald-400">
                        {order.delivery.paymentMode === 'cod' ? 'Cash on Delivery' : 'Pay at Store Pickup'}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Equipment Rentals Page ────────────────────────── */
/* ── Booked Jobs Page ───────────────────────────────
   Every request this shop actually won. A card starts as BOOKED and flips
   itself to DELIVERED the moment the machine reaches the farmer — the server
   already stamps that arrival, so nothing here needs to be pressed. */
function BookedJobsPage({ activeShop }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${EQUIP_API}/requests`);
      if (res.data.success) setRequests(res.data.data);
    } catch (err) {
      console.error('Error fetching booked jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  const myJobs = requests.filter(r =>
    r.status === 'booked' && r.acceptedQuote?.shopId === activeShop.id
  );
  const inTransit = myJobs.filter(r => !r.deliveryNotifiedAt);
  const delivered = myJobs.filter(r => r.deliveryNotifiedAt);

  const formatWhen = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const JobCard = ({ req, isDelivered }) => (
    <div className={`vendor-glass-card space-y-4 relative ${isDelivered ? 'border-emerald-500/25' : 'border-sky-500/25'}`}>
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="font-mono text-xs text-purple-400 font-semibold">{req.id}</span>
        <span className={`status-badge ${isDelivered ? 'ready' : 'confirmed'}`}>
          {isDelivered ? 'DELIVERED' : 'BOOKED · ON THE WAY'}
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

      <div className={`rounded-xl p-3 space-y-1.5 border ${isDelivered ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-sky-500/5 border-sky-500/25'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${isDelivered ? 'text-emerald-400' : 'text-sky-400'}`}>
            Machine Sent
          </span>
          <span className={`text-sm font-bold ${isDelivered ? 'text-emerald-400' : 'text-sky-400'}`}>
            ₹{req.acceptedQuote?.calculatedPrice}
          </span>
        </div>
        <p className="text-sm font-semibold text-white">{req.acceptedQuote?.machineName}</p>
        <p className="text-xs text-zinc-400">
          Driver: {req.acceptedQuote?.ownerName}
          {req.acceptedQuote?.distanceKm ? ` · ${req.acceptedQuote.distanceKm} away` : ''}
        </p>
        <div className="flex items-center gap-4 pt-1 text-[11px] text-zinc-500">
          <span>Owner gets ₹{req.acceptedQuote?.ownerShare}</span>
          <span className="text-purple-400">Your commission ₹{req.acceptedQuote?.vendorCommission}</span>
        </div>
      </div>

      <div className="border-t border-white/5 pt-3">
        <p className="text-xs text-zinc-500">
          {isDelivered
            ? `✅ Reached the farmer on ${formatWhen(req.deliveryNotifiedAt)}. The farmer has been notified by SMS.`
            : `🔒 Booked ${formatWhen(req.bookedAt)}. On its way — this card turns green by itself once the machine reaches the farmer.`}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Booked Jobs</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Jobs farmers booked with <strong className="text-purple-400">{activeShop.name}</strong> · quotes are locked, status updates on its own
        </p>
      </div>

      {loading ? (
        <div className="vendor-glass-card text-center py-12 text-zinc-500">Loading booked jobs...</div>
      ) : myJobs.length === 0 ? (
        <div className="vendor-glass-card text-center py-12 text-zinc-500">
          No booked jobs yet for {activeShop.name}. Win a bid on the Equipment Rentals page and it will appear here.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {inTransit.length > 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">🚜 On The Way ({inTransit.length})</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Machine dispatched, not yet at the farm.</p>
              </div>
              {inTransit.map(req => <JobCard key={req.id} req={req} isDelivered={false} />)}
            </div>
          )}

          {delivered.length > 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">✓ Delivered ({delivered.length})</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Machine has reached the farmer.</p>
              </div>
              {delivered.map(req => <JobCard key={req.id} req={req} isDelivered={true} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Equipment Rentals Page ─────────────────────────── */
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

  const handleSendAllQuotes = async (ownersToQuote) => {
    if (!selectedReq || !ownersToQuote || ownersToQuote.length === 0) return;
    setSendingQuote(true);

    try {
      for (const owner of ownersToQuote) {
        await axios.post(`${EQUIP_API}/requests/${selectedReq.id}/quote`, {
          shopId: activeShop.id,
          shopName: activeShop.name,
          shopPhone: activeShop.phone,
          ownerId: owner.id
        });
      }

      setToastMsg(`Dispatched ${ownersToQuote.length} tractor quote(s) to farmer!`);
      setTimeout(() => setToastMsg(null), 4000);
      setSelectedReq(null);
      setSelectedOwnerId('');
      fetchEquipRequests();
    } catch (err) {
      console.error("Failed to send quotes:", err);
    } finally {
      setSendingQuote(false);
    }
  };

  const shopOwners = owners.filter(o => o.shopId === activeShop.id && o.available);
  // Only owners whose machine type matches what the farmer actually asked for —
  // a Tractor request should never let a Water Pump owner be dispatched to it.
  const getMatchingOwners = (req) => shopOwners
    .filter(o => o.machineType === req.equipmentTypeId)
    // Cheapest bid first, so the best deal for the farmer is the default pick
    .sort((a, b) => (a.biddingPrice ?? Infinity) - (b.biddingPrice ?? Infinity));
  const matchingOwners = selectedReq ? getMatchingOwners(selectedReq) : [];

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

      {(() => {
        // Only show requests this shop can actually serve — hide ones where no
        // registered owner has the matching machine, unless a quote was already
        // sent for it (so in-progress ones stay visible to manage).
        const visibleRequests = requests.filter(req =>
          getMatchingOwners(req).length > 0 || (req.quotes || []).some(q => q.shopId === activeShop.id)
        );

        // Once the farmer picks a bid the job is locked and leaves this list — it
        // moves to the Booked Jobs page, so nobody can re-price a tractor that is
        // already on its way. A request booked with someone else is not this
        // shop's business either, so it simply disappears from here.
        const openRequests = visibleRequests.filter(req => req.status !== 'booked');

        if (loading) {
          return (
            <div className="vendor-glass-card text-center py-12 text-zinc-500">
              Loading equipment requests...
            </div>
          );
        }
        if (openRequests.length === 0) {
          return (
            <div className="vendor-glass-card text-center py-12 text-zinc-500">
              No equipment rental requests match the machines registered under {activeShop.name}.
            </div>
          );
        }

        return (
        <div className="flex flex-col gap-8">
        {openRequests.length > 0 && (
        <div className="flex flex-col gap-4">
          {openRequests.map(req => {
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
                      setSelectedOwnerId(getMatchingOwners(req)[0]?.id || '');
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
        </div>
        );
      })()}

      {/* Quote Dispatch Modal */}
      {selectedReq && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Assign Fleet Machines for Request #{selectedReq.id}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Select individual machines or dispatch quotes for your entire fleet so the farmer can compare prices.</p>
              </div>
              <button onClick={() => setSelectedReq(null)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                <div className="text-white font-semibold flex items-center justify-between">
                  <span>🚜 {selectedReq.equipmentTypeName} — {selectedReq.workType}</span>
                  <span className="text-purple-400 font-mono text-[11px]">{selectedReq.landAreaAcres} Acres</span>
                </div>
                <div className="text-zinc-400 text-[11px]">Location: {selectedReq.location} · Date: {selectedReq.requiredDate}</div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-zinc-300 font-semibold">Available Fleet Machines ({matchingOwners.length}):</label>
                  {matchingOwners.length > 1 && (
                    <button
                      type="button"
                      disabled={sendingQuote}
                      onClick={() => handleSendAllQuotes(matchingOwners)}
                      className="text-[11px] font-bold text-purple-300 hover:text-purple-200 bg-purple-900/60 hover:bg-purple-800/80 px-2.5 py-1 rounded-lg border border-purple-500/40 cursor-pointer shadow transition-all"
                    >
                      🚀 Dispatch All ({matchingOwners.length}) Fleet Quotes
                    </button>
                  )}
                </div>

                {matchingOwners.length === 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs">
                    No available {selectedReq.equipmentTypeName} owners registered under {activeShop.name}. Please register a matching owner in <strong>Fleet & Owners</strong> tab.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {matchingOwners.map(o => {
                      const existingQuote = (selectedReq.quotes || []).find(q => q.ownerId === o.id);
                      const rate = o.biddingPrice || 500;
                      const calculatedPrice = selectedReq.landAreaAcres * rate;
                      const isSelected = selectedOwnerId === o.id;

                      return (
                        <div
                          key={o.id}
                          onClick={() => setSelectedOwnerId(o.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-purple-950/60 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                              : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>🚜 {o.machineName}</span>
                              {existingQuote && (
                                <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">
                                  ✓ Quoted ₹{existingQuote.calculatedPrice}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              Driver: <strong className="text-zinc-200">{o.ownerName}</strong> · Bid Rate: ₹{rate}/acre · {o.rating || 4.8}★
                            </div>
                          </div>

                          <div className="text-right pl-3">
                            <div className="text-xs font-bold text-emerald-400">₹{calculatedPrice}</div>
                            <div className="text-[10px] text-zinc-500">for {selectedReq.landAreaAcres} acres</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Price & Revenue Split Preview for Selected Machine */}
              {(() => {
                const selectedOwner = matchingOwners.find(o => o.id === selectedOwnerId);
                if (!selectedOwner) return null;
                const rate = selectedOwner.biddingPrice || 500;
                const quotePrice = selectedReq.landAreaAcres * rate;
                return (
                  <div className="bg-purple-950/40 border border-purple-500/30 p-3 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-xs font-bold text-white">
                      <span>Selected Quote ({selectedOwner.ownerName} - {selectedOwner.machineName}):</span>
                      <span className="text-emerald-400 font-mono text-sm">₹{quotePrice}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Owner Payout (90%): ₹{Math.round(quotePrice * 0.9)}</span>
                      <span>Vendor Commission (10%): ₹{Math.round(quotePrice * 0.1)}</span>
                    </div>
                  </div>
                );
              })()}
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
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg cursor-pointer disabled:opacity-50"
              >
                {sendingQuote ? 'Dispatching...' : 'Dispatch Selected Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Fleet & Owners Page ──────────────────────────── */
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

function FleetPage({ activeShop, owners, onAddOwner, onToggleOwnerStatus, onUpdateOwner }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOwnerId, setEditingOwnerId] = useState(null);
  const EMPTY_FORM = { ownerName: '', ownerPhone: '', machineType: 'EQ-TRAC', machineName: '', location: '', biddingPrice: '' };
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState(null);
  const [locateError, setLocateError] = useState('');

  const shopOwners = owners.filter(o => o.shopId === activeShop.id);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        try {
          const res = await axios.get(`${API_BASE_URL}/api/auth/reverse-geocode`, {
            params: { lat, lng }
          });
          if (res.data && res.data.success && res.data.address) {
            setFormData(prev => ({ ...prev, location: res.data.address }));
          } else {
            setFormData(prev => ({ ...prev, location: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
          }
        } catch (err) {
          console.error('Reverse geocode error:', err);
          setFormData(prev => ({ ...prev, location: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
        } finally {
          setLocating(false);
        }
      },
      (_err) => {
        setLocating(false);
        setLocateError('Could not fetch GPS location. Please check browser permissions.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const openAddModal = () => {
    setEditingOwnerId(null);
    setFormData(EMPTY_FORM);
    setCoords(null);
    setLocateError('');
    setShowAddModal(true);
  };

  const openManageModal = (owner) => {
    setEditingOwnerId(owner.id);
    setFormData({
      ownerName: owner.ownerName || '',
      ownerPhone: owner.ownerPhone || '',
      machineType: owner.machineType || 'EQ-TRAC',
      machineName: owner.machineName || '',
      location: owner.location || '',
      biddingPrice: owner.biddingPrice || ''
    });
    setCoords(null);
    setLocateError('');
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingOwnerId(null);
    setFormData(EMPTY_FORM);
    setCoords(null);
    setLocateError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingOwnerId) {
      onUpdateOwner(editingOwnerId, { ...formData });
    } else {
      onAddOwner({
        ...formData,
        shopId: activeShop.id,
        shopName: activeShop.name
      });
    }
    closeModal();
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
          onClick={openAddModal}
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
                {o.biddingPrice ? (
                  <p className="text-xs text-emerald-400 font-semibold mt-1">Bidding Price: ₹{Math.round(o.biddingPrice * 1.1)} <span className="text-zinc-500 font-normal">(incl. 10% vendor cut)</span></p>
                ) : null}
              </div>

              <div className="border-t border-white/5 pt-3 flex items-center justify-between mt-3">
                <span className="text-xs font-medium text-zinc-300">
                  {o.available ? '🟢 Available for Rent' : '🔴 Busy / In Use'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openManageModal(o)}
                    className="px-3 py-1 rounded-lg border border-zinc-700 text-zinc-300 text-[11px] font-semibold hover:border-purple-500 hover:text-purple-300 cursor-pointer"
                  >
                    Manage
                  </button>
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
            </div>
          ))
        )}
      </div>

      {/* Add Owner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">{editingOwnerId ? 'Manage Machine Owner' : 'Register Equipment Owner'}</h3>
              <button type="button" onClick={closeModal} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1">Owner Name (Farmer)</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
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
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1">Machine Name & Model</label>
              <select
                value=""
                onChange={(e) => {
                  const preset = MACHINE_PRESETS.find(m => m.name === e.target.value);
                  if (preset) setFormData({ ...formData, machineName: preset.name, machineType: preset.type });
                }}
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none mb-2"
              >
                <option value="" className="bg-zinc-900">-- Pick a common machine (optional) --</option>
                {MACHINE_PRESETS.map(m => (
                  <option key={m.name} value={m.name} className="bg-zinc-900">{m.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={formData.machineName}
                onChange={(e) => setFormData({ ...formData, machineName: e.target.value })}
                placeholder="Or type your own, e.g. Mahindra 575 DI Tractor (45 HP)"
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none"
                required
              />
            </div>

            {/* Address & Location with Map Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-zinc-400 font-semibold">Address / Location</label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="text-[11px] font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer bg-purple-950/50 hover:bg-purple-900/60 px-2.5 py-1 rounded-lg border border-purple-500/30 transition-all disabled:opacity-50"
                >
                  {locating ? (
                    <>
                      <span className="animate-spin text-[10px]">⏳</span> Locating...
                    </>
                  ) : (
                    <>
                      <span>📍</span> Use Current Location
                    </>
                  )}
                </button>
              </div>

              {/* Map Preview Box Above Address */}
              <div className="mb-2 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 relative shadow-inner">
                <iframe
                  title="Owner Location Map"
                  width="100%"
                  height="140"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(formData.location || activeShop?.location || 'Kumbalgodu, Bengaluru')}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                />
                {coords && (
                  <div className="absolute top-2 left-2 bg-zinc-900/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={formData.location}
                onChange={(e) => {
                  setFormData({ ...formData, location: e.target.value });
                  setLocateError('');
                }}
                placeholder="Type location or tap 'Use Current Location'"
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none focus:border-purple-500 transition-colors"
                required
              />
              {locateError && <p className="text-[11px] text-red-400 mt-1">{locateError}</p>}
            </div>

            <div>
              <label className="block text-xs text-zinc-400 font-semibold mb-1">Bidding Price (₹, what this owner charges)</label>
              <input
                type="number"
                min="0"
                value={formData.biddingPrice}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setFormData({ ...formData, biddingPrice: '' });
                  } else {
                    const num = Math.max(0, Number(val));
                    setFormData({ ...formData, biddingPrice: num });
                  }
                }}
                placeholder="e.g. 450"
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 rounded-xl outline-none"
                required
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Rate per acre/hour/trip depending on machine type. Lower price wins more bookings — this is how owners compete for the same job.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-lg"
              >
                {editingOwnerId ? 'Save Changes' : 'Save Owner'}
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

/* ── Deliveries Page ───────────────────────── */
function DeliveriesPage({ orders, activeShop }) {
  const shopDeliveries = orders.filter(
    o => (o.status === 'ready' || o.status === 'delivered') && o.claimedByShopId === activeShop.id && o.delivery
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Deliveries</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Orders ready for pickup/delivery for <strong className="text-purple-400">{activeShop.name}</strong>
        </p>
      </div>

      {shopDeliveries.length === 0 ? (
        <div className="vendor-glass-card text-center py-12 text-zinc-500">
          No deliveries yet for {activeShop.name}. Orders show up here once the farmer confirms a delivery address.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {shopDeliveries.map(order => {
            const isDelivered = order.status === 'delivered';
            return (
            <div key={order.id} className="vendor-glass-card space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="font-mono text-xs text-purple-400 font-semibold">{order.id}</span>
                <span className={`status-badge ${isDelivered ? 'delivered' : 'ready'}`}>
                  {isDelivered ? '✅ DELIVERED' : 'ADDRESS CONFIRMED'}
                </span>
              </div>

              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Farmer: {order.farmerName}</span>
                  <a href={`tel:${order.farmerPhone}`} className="text-xs text-emerald-400 font-medium hover:underline">
                    Call: {order.farmerPhone}
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider">Items:</span>
                <div className="space-y-1.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-zinc-900/40 px-3 py-2 rounded-lg border border-white/5">
                      <span className="text-white font-medium">{item.name}</span>
                      <span className="text-emerald-400 font-semibold">₹{item.price} x{item.qty || 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  📦 Delivery Address
                </span>
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <strong className="text-white">{order.delivery.fullName}</strong> · {order.delivery.phone}
                  <br />
                  {order.delivery.address}
                  {order.delivery.landmark ? `, ${order.delivery.landmark}` : ''}
                  {order.delivery.pincode ? ` - ${order.delivery.pincode}` : ''}
                  <br />
                  Payment:{' '}
                  <strong className="text-emerald-400">
                    {order.delivery.paymentMode === 'cod' ? 'Cash on Delivery' : 'Pay at Store Pickup'}
                  </strong>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">Total Value:</span>
                <span className="text-base font-bold text-white">₹{order.totalAmount}</span>
              </div>
            </div>
          );})}
        </div>
      )}
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
  const [equipRequests, setEquipRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [claimToast, setClaimToast] = useState(null);

  const loadShops = async () => {
    try {
      const res = await axios.get(`${API_BASE}/shops`);
      if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const newShops = res.data.data;
        setShops(newShops);
        setActiveShop(prev => {
          if (!prev) return newShops[0];
          const exists = newShops.some(s => s.id === prev.id);
          return exists ? prev : newShops[0];
        });
      }
    } catch (e) {}
  };

  const loadVendorData = async () => {
    try {
      const [ordRes, prodRes, statRes, ownRes, equipReqRes] = await Promise.all([
        axios.get(`${API_BASE}/orders`),
        axios.get(`${API_BASE}/products?shopId=${activeShop.id}`),
        axios.get(`${API_BASE}/stats?shopId=${activeShop.id}`),
        axios.get(`${EQUIP_API}/owners?shopId=${activeShop.id}`),
        axios.get(`${EQUIP_API}/requests`)
      ]);
      if (ordRes.data.success) setOrders(ordRes.data.data);
      if (prodRes.data.success) setProducts(prodRes.data.data);
      if (statRes.data.success) setStats(statRes.data.data);
      if (ownRes.data.success) setOwners(ownRes.data.data);
      if (equipReqRes.data.success) setEquipRequests(equipReqRes.data.data);
    } catch (err) {
      console.error("Vendor fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
    const shopsInterval = setInterval(loadShops, 5000);
    return () => clearInterval(shopsInterval);
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
      await axios.patch(`${API_BASE}/products/${productId}/stock`, { inStock, shopId: activeShop.id });
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

  const handleUpdateOwner = async (ownerId, updatedData) => {
    try {
      await axios.patch(`${EQUIP_API}/owners/${ownerId}`, updatedData);
      loadVendorData();
    } catch (err) {
      console.error("Failed to update owner:", err);
    }
  };

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const pendingEquipCount = equipRequests.filter(r =>
    r.status !== 'booked' && !(r.quotes || []).some(q => q.shopId === activeShop.id)
  ).length;
  const deliveriesCount = orders.filter(
    o => o.status === 'ready' && o.claimedByShopId === activeShop.id && o.delivery
  ).length;

  const routerBasename = typeof window !== 'undefined' && window.location.pathname.startsWith('/vendor') ? '/vendor' : '';

  return (
    <BrowserRouter basename={routerBasename}>
      <div className="min-h-screen bg-[#0a0a0c] text-white">
        <div className="vendor-orb vendor-orb-1" />
        <div className="vendor-orb vendor-orb-2" />

        <VendorNavbar
          pendingCount={pendingCount}
          pendingEquipCount={pendingEquipCount}
          deliveriesCount={deliveriesCount}
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
            <Route path="/deliveries" element={
              <DeliveriesPage
                orders={orders}
                activeShop={activeShop}
              />
            } />
            <Route path="/equipment-rentals" element={
              <EquipmentRentalsPage
                activeShop={activeShop}
                owners={owners}
              />
            } />
            <Route path="/booked-jobs" element={
              <BookedJobsPage activeShop={activeShop} />
            } />
            <Route path="/fleet" element={
              <FleetPage
                activeShop={activeShop}
                owners={owners}
                onAddOwner={handleAddOwner}
                onToggleOwnerStatus={handleToggleOwnerStatus}
                onUpdateOwner={handleUpdateOwner}
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
