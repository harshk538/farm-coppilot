import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const VENDOR_API = `${API_BASE_URL}/api/vendor`;

export default function Orders({ user, onLogin }) {
  const navigate = useNavigate();
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstruction, setSelectedInstruction] = useState(null);
  const [orderingId, setOrderingId] = useState(null);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState(null);

  // Delivery form state
  const [deliveryModal, setDeliveryModal] = useState(null); // order object or null
  const [deliveryForm, setDeliveryForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    landmark: '',
    pincode: '',
    paymentMode: 'cod',
  });
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // Load persistent AI recommended products
  useEffect(() => {
    try {
      const stored = localStorage.getItem('fc_advisory_products');
      if (stored) {
        setRecommendedProducts(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse recommended products:", e);
    }
  }, []);

  // Fetch Live Farmer Orders & Poll every 3 seconds
  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${VENDOR_API}/orders`);
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  // Place Order Action (Broadcast to all nearby shops)
  const handlePlaceOrder = async (product) => {
    if (!user) {
      if (onLogin) onLogin();
      return;
    }
    setOrderingId(product.id);
    try {
      const res = await axios.post(`${VENDOR_API}/orders`, {
        farmerName: user.name,
        farmerPhone: user.phone,
        location: 'Kumbalgodu, Bengaluru',
        items: [{
          id: product.id || 'P-ITEM',
          name: product.name,
          category: product.category || 'chemical',
          price: product.price || 350,
          qty: 1
        }]
      });

      if (res.data.success) {
        setOrderSuccessMsg(`Order #${res.data.data.id} broadcasted to nearby vendors.`);
        setTimeout(() => setOrderSuccessMsg(null), 4000);
        fetchOrders();
      }
    } catch (err) {
      console.error("Failed to place order:", err);
    } finally {
      setOrderingId(null);
    }
  };

  // Cancel Order Action
  const handleCancelOrder = async (orderId) => {
    try {
      // Immediately remove from UI for instant response
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setOrderSuccessMsg(`Order #${orderId} has been cancelled.`);
      setTimeout(() => setOrderSuccessMsg(null), 3000);

      await axios.delete(`${VENDOR_API}/orders/${orderId}`);
    } catch (err) {
      console.error("Failed to cancel order:", err);
      fetchOrders();
    }
  };

  // Open delivery form modal
  const openDeliveryModal = (order) => {
    setDeliveryForm({
      fullName: user?.name || order.farmerName || '',
      phone: user?.phone || order.farmerPhone || '',
      address: order.location || '',
      landmark: '',
      pincode: '',
      paymentMode: 'cod',
    });
    setDeliveryModal(order);
  };

  // Submit delivery form — save delivery info to order and update UI
  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    setSubmittingDelivery(true);

    try {
      // Save delivery info to the order on the server so the claiming vendor can see it too
      await axios.patch(`${VENDOR_API}/orders/${deliveryModal.id}/delivery`, deliveryForm);

      setOrderSuccessMsg(`Delivery confirmed for Order #${deliveryModal.id}! Track route below.`);
      setTimeout(() => setOrderSuccessMsg(null), 5000);
      setDeliveryModal(null);
      fetchOrders();
    } catch (err) {
      console.error("Failed to confirm delivery:", err);
      setOrderSuccessMsg('Could not confirm delivery. Please try again.');
      setTimeout(() => setOrderSuccessMsg(null), 4000);
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Navigate to Treatment map to track the vendor-to-you delivery route, same as equipment tracking
  const navigateToRoute = (order) => {
    const delivery = getDeliveryInfo(order);
    const shopName = order.claimedByShopName || order.shopName || '';
    const destParams = delivery?.location
      ? `&destLat=${delivery.location.lat}&destLng=${delivery.location.lng}`
      : '';
    navigate(
      `/treatment?trackOrder=${order.id}&shopId=${order.claimedByShopId || ''}` +
      `&shopName=${encodeURIComponent(shopName)}` +
      `&phone=${encodeURIComponent(delivery?.phone || order.farmerPhone || '')}` +
      `&bookedAt=${encodeURIComponent(delivery?.confirmedAt || '')}` +
      destParams
    );
  };

  // Check if delivery was confirmed for an order — prefer the server copy (visible to the
  // vendor too); fall back to the old localStorage-only entry for orders confirmed before
  // delivery details were saved server-side.
  const getDeliveryInfo = (order) => {
    if (order.delivery) return order.delivery;
    try {
      const stored = localStorage.getItem(`fc_delivery_${order.id}`);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Success Notification Banner */}
      {orderSuccessMsg && (
        <div style={{
          backgroundColor: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(16,185,129,0.4)',
          borderRadius: '12px',
          padding: '14px 18px',
          color: '#34d399',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>{orderSuccessMsg}</span>
        </div>
      )}

      {/* ── SECTION 1: RECOMMENDED PRODUCTS READY TO ORDER ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
              Recommended Products for Your Crop
            </h2>
            <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0' }}>
              Directly recommended by AI Advisory based on your latest diagnosis
            </p>
          </div>
        </div>

        {recommendedProducts.length === 0 ? (
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderStyle: 'dashed',
            borderRadius: '14px',
            padding: '32px',
            textAlign: 'center',
            color: '#666'
          }}>
            No recommended products yet. Upload a crop photo in <strong>AI Advisory</strong> or select a disease in <strong>Treatment</strong> to see targeted chemical recommendations here.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {recommendedProducts.map((prod) => (
              <div
                key={prod.id}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase',
                      backgroundColor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                      padding: '2px 8px', borderRadius: '100px'
                    }}>
                      {prod.category}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#4ade80' }}>
                      ₹{prod.price}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
                    {prod.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', margin: '0 0 8px' }}>
                    {prod.activeIngredient}
                  </p>
                  {prod.dosage && (
                    <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0 }}>
                      Dose: <strong>{prod.dosage}</strong>
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedInstruction({
                      name: prod.name,
                      dosage: prod.dosage,
                      category: prod.category,
                      precautions: prod.whyThis,
                      application: `Apply ${prod.name} (${prod.activeIngredient}) as directed for targeted crop protection.`
                    })}
                    className="instruction-btn"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                  >
                    Usage Instructions
                  </button>

                  <button
                    type="button"
                    disabled={orderingId === prod.id}
                    onClick={() => handlePlaceOrder(prod)}
                    style={{
                      flex: 1,
                      backgroundColor: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {orderingId === prod.id ? 'Ordering...' : 'Order Product'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 2: LIVE ORDERS TRACKER & HISTORY ── */}
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
            My Orders & Live Vendor Broadcasts
          </h2>
          <p style={{ fontSize: '13px', color: '#888', margin: '4px 0 0' }}>
            Real-time status updates broadcasted to nearby agro suppliers
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            color: '#666'
          }}>
            No orders placed yet. Click <strong>"Order Product"</strong> on any recommendation above to broadcast to local vendors.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orders.map((order) => {
              const activeShopName = order.claimedByShopName || order.shopName || 'Broadcast to Nearby Vendors';
              const delivery = getDeliveryInfo(order);

              return (
                <div
                  key={order.id}
                  style={{
                    backgroundColor: 'rgba(20,20,26,0.7)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Order Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#c4b5fd' }}>
                        {order.id}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7' }}>
                        {activeShopName}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span className={`status-badge ${order.status}`}>
                      {order.status === 'pending' && 'ORDER BROADCASTED · CHECKING STOCK'}
                      {order.status === 'confirmed' && `STOCK CONFIRMED BY ${order.claimedByShopName || order.shopName}`}
                      {order.status === 'ready' && (delivery ? 'DELIVERY CONFIRMED' : 'READY FOR PICKUP')}
                      {order.status === 'rejected' && 'OUT OF STOCK'}
                    </span>
                  </div>

                  {/* Items & Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}>
                        Requested Items:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {order.items.map((item, idx) => (
                          <span key={idx} style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            color: '#fff',
                            fontWeight: 500
                          }}>
                            {item.name} {item.qty > 1 ? `x${item.qty}` : ''} — <strong style={{ color: '#4ade80' }}>₹{item.price}</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#888' }}>Total Amount:</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>₹{order.totalAmount}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {/* Confirm Delivery / Track Route buttons for ready orders */}
                        {order.status === 'ready' && !delivery && (
                          <button
                            type="button"
                            onClick={() => openDeliveryModal(order)}
                            style={{
                              backgroundColor: '#10b981',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '10px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.target.style.backgroundColor = '#059669'; e.target.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { e.target.style.backgroundColor = '#10b981'; e.target.style.transform = 'translateY(0)'; }}
                          >
                            🛒 Confirm Delivery
                          </button>
                        )}


                        <button
                          type="button"
                          onClick={() => handleCancelOrder(order.id)}
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '8px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onMouseEnter={e => { e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'; e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)'; }}
                          onMouseLeave={e => { e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'; e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}
                        >
                          Cancel Order
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delivery info card — shown after confirming delivery */}
                  {delivery && order.status === 'ready' && (
                    <div style={{
                      backgroundColor: 'rgba(59,130,246,0.06)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.5px', marginBottom: '4px' }}>
                          📦 DELIVERY DETAILS
                        </div>
                        <div style={{ fontSize: '12px', color: '#ccc', lineHeight: 1.6 }}>
                          <strong>{delivery.fullName}</strong> · {delivery.phone}<br />
                          {delivery.address}{delivery.landmark ? `, ${delivery.landmark}` : ''}{delivery.pincode ? ` - ${delivery.pincode}` : ''}<br />
                          Payment: <strong style={{ color: '#4ade80' }}>{delivery.paymentMode === 'cod' ? 'Cash on Delivery' : 'Pay at Store'}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateToRoute(order)}
                        style={{
                          backgroundColor: 'rgba(59,130,246,0.15)',
                          border: '1px solid rgba(59,130,246,0.3)',
                          color: '#60a5fa',
                          borderRadius: '12px',
                          padding: '10px 18px',
                          fontSize: '20px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => { e.target.style.backgroundColor = 'rgba(59,130,246,0.3)'; e.target.style.transform = 'scale(1.1)'; }}
                        onMouseLeave={e => { e.target.style.backgroundColor = 'rgba(59,130,246,0.15)'; e.target.style.transform = 'scale(1)'; }}
                        title="Track vendor-to-you route on map"
                      >
                        →
                      </button>
                    </div>
                  )}

                  {/* Dynamic Explanatory Footer based on status */}
                  {order.status === 'pending' && (
                    <div style={{
                      backgroundColor: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fbbf24', display: 'inline-block' }} />
                      Order broadcasted to nearby vendors. Waiting for first shop to confirm stock availability.
                    </div>
                  )}

                  {order.status === 'confirmed' && (
                    <div style={{
                      backgroundColor: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: '#34d399',
                      fontWeight: 500
                    }}>
                      Stock confirmed by <strong>{order.claimedByShopName || order.shopName}</strong>. Ready for pickup or call <strong>{order.shopPhone || '+91 98765 43210'}</strong>.
                    </div>
                  )}

                  {order.status === 'ready' && !delivery && (
                    <div style={{
                      backgroundColor: 'rgba(59,130,246,0.06)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: '#60a5fa',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '14px' }}>📦</span>
                      Your order is ready! Click <strong style={{ margin: '0 3px' }}>Confirm Delivery</strong> to fill in delivery details and track the route from vendor to your location.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DELIVERY ORDER FORM MODAL ── */}
      {deliveryModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setDeliveryModal(null)}
        >
          <form
            onSubmit={handleDeliverySubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#111114',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '480px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>📦</span>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0 }}>
                    Confirm Delivery
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                  Order <strong style={{ color: '#c4b5fd' }}>#{deliveryModal.id}</strong> · {deliveryModal.claimedByShopName || deliveryModal.shopName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryModal(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888',
                  borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer',
                  fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Order Summary */}
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                {deliveryModal.items.map((item, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#e4e4e7', fontWeight: 500 }}>
                    {item.name} x{item.qty || 1}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>₹{deliveryModal.totalAmount}</div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '5px', letterSpacing: '0.3px' }}>FULL NAME *</label>
                <input
                  type="text"
                  required
                  value={deliveryForm.fullName}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, fullName: e.target.value })}
                  placeholder="e.g. Harsh Kumar"
                  style={{
                    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '13px',
                    outline: 'none', transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '5px', letterSpacing: '0.3px' }}>PHONE NUMBER *</label>
                <input
                  type="tel"
                  required
                  value={deliveryForm.phone}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '13px',
                    outline: 'none', transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '5px', letterSpacing: '0.3px' }}>DELIVERY ADDRESS *</label>
                <input
                  type="text"
                  required
                  value={deliveryForm.address}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, address: e.target.value })}
                  placeholder="Village, Town/City, District"
                  style={{
                    width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                    padding: '10px 14px', color: '#fff', fontSize: '13px',
                    outline: 'none', transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '5px', letterSpacing: '0.3px' }}>LANDMARK</label>
                  <input
                    type="text"
                    value={deliveryForm.landmark}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, landmark: e.target.value })}
                    placeholder="Near temple, bus stop..."
                    style={{
                      width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                      padding: '10px 14px', color: '#fff', fontSize: '13px',
                      outline: 'none', transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '5px', letterSpacing: '0.3px' }}>PINCODE</label>
                  <input
                    type="text"
                    value={deliveryForm.pincode}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, pincode: e.target.value })}
                    placeholder="560082"
                    style={{
                      width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                      padding: '10px 14px', color: '#fff', fontSize: '13px',
                      outline: 'none', transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '8px', letterSpacing: '0.3px' }}>PAYMENT MODE</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { value: 'cod', label: '💵 Cash on Delivery' },
                    { value: 'store', label: '🏪 Pay at Store Pickup' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDeliveryForm({ ...deliveryForm, paymentMode: opt.value })}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: deliveryForm.paymentMode === opt.value
                          ? '1.5px solid rgba(16,185,129,0.6)'
                          : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: deliveryForm.paymentMode === opt.value
                          ? 'rgba(16,185,129,0.1)'
                          : 'rgba(255,255,255,0.03)',
                        color: deliveryForm.paymentMode === opt.value ? '#34d399' : '#888',
                        transition: 'all 0.2s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '6px' }}>
              <button
                type="button"
                onClick={() => setDeliveryModal(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ccc', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDelivery}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  backgroundColor: '#10b981', border: 'none',
                  color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(16,185,129,0.3)',
                  transition: 'all 0.15s',
                  opacity: submittingDelivery ? 0.6 : 1,
                }}
              >
                {submittingDelivery ? 'Confirming...' : 'Confirm & Track Route →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── USAGE INSTRUCTIONS MODAL SYSTEM ── */}
      {selectedInstruction && (
        <div className="instruction-modal-backdrop" onClick={() => setSelectedInstruction(null)}>
          <div className="instruction-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="instruction-step-purple">{selectedInstruction.category || 'CHEMICAL USAGE'}</span>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: '6px 0 0' }}>
                  {selectedInstruction.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstruction(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888',
                  borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer',
                  fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Dosage */}
            {selectedInstruction.dosage && (
              <div className="instruction-step-box">
                <span className="instruction-step-num">DOSAGE & RATIO</span>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#e4e4e7', fontWeight: 600 }}>
                  {selectedInstruction.dosage}
                </p>
              </div>
            )}

            {/* Application Method */}
            <div className="instruction-step-box">
              <span className="instruction-step-num">APPLICATION METHOD</span>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#d4d4d8', lineHeight: 1.5 }}>
                {selectedInstruction.application}
              </p>
            </div>

            {/* Safety & Precautions */}
            {selectedInstruction.precautions && (
              <div className="instruction-step-box" style={{ borderLeftColor: '#f59e0b' }}>
                <span className="instruction-step-num" style={{ color: '#fbbf24' }}>SAFETY & PRECAUTIONS</span>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#d4d4d8', lineHeight: 1.5 }}>
                  {selectedInstruction.precautions}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedInstruction(null)}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, marginTop: '8px'
              }}
            >
              Close Instructions
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
