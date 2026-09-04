import express from 'express';
import axios from 'axios';
import { readConfig, writeConfig } from '../utils/mongoStore.js';
import { sendSMS } from '../utils/sms.js';

const router = express.Router();

const DEFAULT_SHOPS_SEED = [
  { id: 'SHOP-001', name: 'Shree Agro Suppliers', location: 'Kumbalgodu, Bengaluru', phone: '+91 98765 43210', license: 'AG-KA-88219', coords: { lat: 12.8898, lng: 77.4519 } },
  { id: 'SHOP-002', name: 'Sri Chamundeshwari Fertilizers', location: 'Kengeri, Bengaluru', phone: '+91 99887 76655', license: 'AG-KA-99120', coords: { lat: 12.9081, lng: 77.4835 } },
  { id: 'SHOP-003', name: 'Hassan Agro Bio Tech', location: 'Bannerghatta, Bengaluru', phone: '+91 97766 55443', license: 'AG-KA-77312', coords: { lat: 12.8004, lng: 77.5773 } },
  { id: 'SHOP-004', name: 'Venkateshwara Krishi Kendra', location: 'Tavarekere, Bengaluru', phone: '+91 96655 44332', license: 'AG-KA-66415', coords: { lat: 12.8763, lng: 77.6031 } }
];

// Vendor shop registry is now Mongo-backed (the "vendorShops" config
// collection) so the farmer app's nearby-shops search can auto-add real
// shops into the vendor "Active Store Context" list.
const readVendorShops = async () => {
  try {
    const data = await readConfig('vendorShops', { shops: DEFAULT_SHOPS_SEED, replaced: false, nextShopNum: 5 });
    if (!Array.isArray(data.shops) || data.shops.length === 0) data.shops = DEFAULT_SHOPS_SEED;
    if (!data.nextShopNum) data.nextShopNum = 5;
    return data;
  } catch (err) {
    console.error('Error reading vendorShops from MongoDB:', err.message);
    return { shops: DEFAULT_SHOPS_SEED, replaced: false, nextShopNum: 5 };
  }
};

const writeVendorShops = async (data) => {
  try {
    await writeConfig('vendorShops', data);
  } catch (err) {
    console.error('Error writing vendorShops to MongoDB:', err.message);
  }
};

const getShopIds = async () => (await readVendorShops()).shops.map(s => s.id);

// Resolve a product's stock status for a specific shop, falling back to the
// legacy global `inStock` flag for shops that don't have their own entry yet.
const resolveStockForShop = (product, shopId) => {
  if (shopId && product.stockByShop && Object.prototype.hasOwnProperty.call(product.stockByShop, shopId)) {
    return product.stockByShop[shopId];
  }
  return product.inStock !== false;
};

// Helper to read orders (the "orders" config collection: { orders: [...] })
const readOrders = async () => {
  try {
    const doc = await readConfig('orders', { orders: [] });
    return doc.orders || [];
  } catch (err) {
    console.error("Error reading orders from MongoDB:", err.message);
    return [];
  }
};

// Helper to write orders
const writeOrders = async (orders) => {
  try {
    await writeConfig('orders', { orders });
  } catch (err) {
    console.error("Error writing orders to MongoDB:", err.message);
  }
};

// Product catalog is read/written from several handlers below — same
// "config" collection pattern as vendorShops/orders.
const readCatalog = async () => {
  try {
    return await readConfig('productCatalog', { products: [] });
  } catch (err) {
    console.error('Error reading productCatalog from MongoDB:', err.message);
    return { products: [] };
  }
};
const writeCatalog = async (catalogData) => {
  try {
    await writeConfig('productCatalog', catalogData);
  } catch (err) {
    console.error('Error writing productCatalog to MongoDB:', err.message);
  }
};

const readOwners = async () => {
  try {
    return await readConfig('equipmentOwners', { owners: [] });
  } catch (err) {
    console.error('Error reading equipmentOwners from MongoDB:', err.message);
    return { owners: [] };
  }
};
const writeOwners = async (ownersData) => {
  try {
    await writeConfig('equipmentOwners', ownersData);
  } catch (err) {
    console.error('Error writing equipmentOwners to MongoDB:', err.message);
  }
};

// Simulated delivery duration for the demo tracking map (kept in sync with the frontend's DELIVERY_DURATION_MS)
const ORDER_DELIVERY_DURATION_MS = 2 * 60 * 1000; // 2 minutes

// Helper: Notify the farmer by SMS once the (simulated) order delivery has arrived
const sendOrderDeliveredSMS = async (order) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log('[SMS Skip] No FAST2SMS_API_KEY set in .env');
    return;
  }
  const phone = (order.delivery?.phone || '').replace(/\D/g, '').slice(-10);
  if (!phone) return;

  const messageText = `Farm Copilot: Your order ${order.id} from ${order.claimedByShopName || order.shopName || 'the vendor'} has arrived at your delivery address.`;

  try {
    console.log(`[Fast2SMS] Sending order-arrived SMS to ${phone}...`);
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: apiKey,
        route: 'q',
        message: messageText,
        language: 'english',
        flash: 0,
        numbers: phone
      }
    });
    console.log('✅ Fast2SMS Order-Arrived Result:', response.data);
  } catch (error) {
    console.error('❌ Fast2SMS Order-Arrived Error:', error.response?.data || error.message);
  }
};

// Background check: runs independently of any open browser tab, so the delivery keeps
// progressing and the farmer gets notified even if no one has the tracking map open.
setInterval(async () => {
  try {
    const orders = await readOrders();
    let changed = false;
    const now = Date.now();

    for (const o of orders) {
      if (o.status === 'ready' && o.delivery && o.delivery.confirmedAt && !o.delivery.notifiedAt) {
        const elapsed = now - new Date(o.delivery.confirmedAt).getTime();
        if (elapsed >= ORDER_DELIVERY_DURATION_MS) {
          o.delivery.notifiedAt = new Date().toISOString();
          o.status = 'delivered';
          changed = true;
          sendOrderDeliveredSMS(o);
        }
      }
    }

    if (changed) await writeOrders(orders);
  } catch (e) {
    console.error('Order delivery-arrival check failed:', e.message);
  }
}, 15000);

// GET active shops list (only shops from the most recent nearby-shops sync are shown;
// shops not in range anymore stay saved but hidden — see /sync-shops below)
router.get('/shops', async (req, res) => {
  const allShops = (await readVendorShops()).shops;
  const visible = allShops.filter(s => s.active !== false);
  res.json({ success: true, data: visible });
});

// GET all orders
router.get('/orders', async (req, res) => {
  const orders = await readOrders();
  res.json({ success: true, data: orders });
});

// POST new order (Broadcasted by Farmer to all local shops)
router.post('/orders', async (req, res) => {
  try {
    const { farmerName, farmerPhone, location, items } = req.body;
    const orders = await readOrders();

    const totalAmount = (items || []).reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);

    // Auto-sync ordered items into Product Catalog if not present
    try {
      const catalogData = await readCatalog();
      let catalogProducts = catalogData.products || [];
      let updated = false;

      const shopIds = await getShopIds();
      for (const item of (items || [])) {
        if (!item || !item.name) continue;
        const exists = catalogProducts.some(p => p.name.toLowerCase() === item.name.toLowerCase());
        if (!exists) {
          catalogProducts.push({
            id: item.id || `CSV-${Math.floor(100 + Math.random() * 900)}`,
            name: item.name,
            category: (item.category || 'insecticide').toLowerCase(),
            activeIngredient: item.activeIngredient || item.name,
            dosage: item.dosage || '1.5 - 2.5ml per litre of water',
            price: item.price || 350,
            unit: '250ml',
            inStock: true,
            stockByShop: Object.fromEntries(shopIds.map(sid => [sid, true])),
            verified: true,
            whyThis: 'AI recommended treatment for crop protection'
          });
          updated = true;
        }
      }

      if (updated) {
        catalogData.products = catalogProducts;
        await writeCatalog(catalogData);
      }
    } catch (e) {}

    const newOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      farmerName: farmerName || 'Local Farmer',
      farmerPhone: farmerPhone || '+91 98765 00000',
      location: location || 'Kumbalgodu, Bengaluru',
      broadcast: true,
      shopId: null,
      shopName: 'Broadcast to Nearby Vendors',
      items: items || [],
      totalAmount,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    orders.unshift(newOrder);
    await writeOrders(orders);

    res.json({ success: true, data: newOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH order status (Confirm / Claim, Reject, Ready for Pickup)
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, shopId, shopName, shopPhone } = req.body;
    const orders = await readOrders();

    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const targetOrder = orders[orderIndex];

    // Race condition check: First shop to claim wins!
    if (status === 'confirmed') {
      if (targetOrder.status === 'confirmed' && targetOrder.claimedByShopId !== shopId) {
        return res.status(409).json({
          success: false,
          alreadyClaimed: true,
          claimedByShopName: targetOrder.claimedByShopName,
          message: `Order already claimed by ${targetOrder.claimedByShopName}`
        });
      }

      targetOrder.status = 'confirmed';
      targetOrder.claimedByShopId = shopId || 'SHOP-001';
      targetOrder.claimedByShopName = shopName || 'Shree Agro Suppliers';
      targetOrder.shopName = shopName || 'Shree Agro Suppliers';
      targetOrder.shopPhone = shopPhone || '+91 98765 43210';
      targetOrder.claimedAt = new Date().toISOString();
    } else {
      targetOrder.status = status;
    }

    targetOrder.updatedAt = new Date().toISOString();
    await writeOrders(orders);

    // If order status is marked as 'ready', trigger Fast2SMS notification
    if (status === 'ready') {
      const recipientPhone = targetOrder.farmerPhone || '7070799420';
      const shopName = targetOrder.claimedByShopName || targetOrder.shopName || 'Vendor Shop';
      const orderId = targetOrder.id || id;
      const message = `Farm Copilot: Order ${orderId} is READY FOR PICKUP at ${shopName}. Please collect your order. Thank you!`;
      
      // Async trigger SMS so it doesn't block API response
      sendSMS(recipientPhone, message)
        .then(result => console.log(`[SMS Status]:`, result))
        .catch(err => console.error('[SMS Failed]:', err));
    }

    res.json({ success: true, data: targetOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST test SMS endpoint
router.post('/test-sms', async (req, res) => {
  try {
    const { phone, message } = req.body;
    const targetPhone = phone || '7070799420';
    const msg = message || 'Farm Copilot Test: Order ORD-1963 is READY FOR PICKUP at SHRIZEE AGRO FOODS!';
    const result = await sendSMS(targetPhone, msg);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE order (Cancel Order by Farmer)
router.delete('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let orders = await readOrders();

    const orderExists = orders.some(o => o.id === id);
    if (!orderExists) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    orders = orders.filter(o => o.id !== id);
    await writeOrders(orders);

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH order delivery details (Farmer fills this in once the order is ready)
// Turn a typed address into real map coordinates using Google Geocoding,
// so the delivery tracking map can drive to the farmer's actual address
// instead of a fixed demo point. Returns null if it can't be resolved.
const geocodeAddress = async (fullAddressText) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !fullAddressText) return null;
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: fullAddressText, key: apiKey }
    });
    const result = response.data?.results?.[0];
    if (result?.geometry?.location) {
      return { lat: result.geometry.location.lat, lng: result.geometry.location.lng };
    }
  } catch (err) {
    console.error('Geocode error:', err.response?.data || err.message);
  }
  return null;
};

router.patch('/orders/:id/delivery', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, address, landmark, pincode, paymentMode } = req.body;
    const orders = await readOrders();

    const orderIndex = orders.findIndex(o => o.id === id);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Geocode the full typed address (with landmark + pincode for accuracy)
    const fullAddressText = [address, landmark, pincode].filter(Boolean).join(', ');
    const location = await geocodeAddress(fullAddressText);

    const targetOrder = orders[orderIndex];
    targetOrder.delivery = {
      fullName: fullName || '',
      phone: phone || '',
      address: address || '',
      landmark: landmark || '',
      pincode: pincode || '',
      paymentMode: paymentMode === 'store' ? 'store' : 'cod',
      confirmedAt: new Date().toISOString(),
      location: location || null, // real lat/lng from the typed address, when resolvable
    };
    targetOrder.updatedAt = new Date().toISOString();

    await writeOrders(orders);
    res.json({ success: true, data: targetOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Vendor products with stock status (scoped to the requesting shop)
router.get('/products', async (req, res) => {
  try {
    const { shopId } = req.query;
    const catalogData = await readCatalog();
    const products = catalogData.products || [];
    const scoped = products.map(p => ({ ...p, inStock: resolveStockForShop(p, shopId) }));
    res.json({ success: true, data: scoped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH toggle product stock status for ONE shop only
router.patch('/products/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { inStock, shopId } = req.body;

    const catalogData = await readCatalog();
    const products = catalogData.products || [];

    const prod = products.find(p => p.id === id);
    if (prod) {
      if (shopId) {
        if (!prod.stockByShop) {
          // First time this product is toggled per-shop: seed every known
          // shop from the old global flag so nobody else's status jumps.
          const legacyValue = prod.inStock !== false;
          const shopIds = await getShopIds();
          prod.stockByShop = Object.fromEntries(shopIds.map(sid => [sid, legacyValue]));
        }
        prod.stockByShop[shopId] = inStock;
      } else {
        // No shop context (legacy callers) — fall back to the old global behavior.
        prod.inStock = inStock;
      }
      prod.inStock = prod.stockByShop ? Object.values(prod.stockByShop).some(Boolean) : inStock;
      await writeCatalog(catalogData);
    }

    res.json({ success: true, data: prod ? { ...prod, inStock: resolveStockForShop(prod, shopId) } : prod });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Vendor Stats Overview
router.get('/stats', async (req, res) => {
  const { shopId } = req.query;
  const orders = await readOrders();
  const pending = orders.filter(o => o.status === 'pending').length;
  
  // Filter confirmed orders for specific shop or all
  const shopOrders = shopId 
    ? orders.filter(o => o.claimedByShopId === shopId)
    : orders.filter(o => o.status === 'confirmed' || o.status === 'ready' || o.status === 'delivered');

  const confirmed = shopOrders.filter(o => o.status === 'confirmed' || o.status === 'ready' || o.status === 'delivered').length;
  const totalRevenue = shopOrders
    .filter(o => o.status === 'confirmed' || o.status === 'ready' || o.status === 'delivered')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  res.json({
    success: true,
    data: {
      pendingOrders: pending,
      confirmedOrders: confirmed,
      totalRevenue,
      activeProductsCount: 16
    }
  });
});


/* ── Auto-sync nearest real agri shops from farmer search into vendor portal ── */
const MACHINE_TYPES = [
  { type: 'EQ-TRAC', names: ['Mahindra 575 DI Tractor (45 HP)', 'Sonalika DI 745 III (50 HP)', 'Swaraj 744 FE Tractor (48 HP)'] },
  { type: 'EQ-ROTA', names: ['Shaktiman Rotary Tiller 7ft', 'Fieldking Rotavator 6ft'] },
  { type: 'EQ-HARV', names: ['Kubota DC-68G Combine Harvester', 'Preet 987 Combine Harvester'] },
  { type: 'EQ-PUMP', names: ['Kirloskar 5HP Heavy Diesel Water Pump', 'Crompton 3HP Submersible Pump'] }
];
const FIRST_NAMES = ['Ramesh', 'Suresh', 'Manjunath', 'Venkatesh', 'Basavaraj', 'Puttaswamy', 'Nagaraj', 'Krishnappa', 'Shivakumar', 'Lokesh'];
const LAST_NAMES = ['Gowda', 'Reddy', 'Swamy', 'Naidu', 'Setty', 'Kumar', 'Rao'];
const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomPhone = () => `+91 9${Math.floor(1000000 + Math.random() * 8999999)}`;

// POST nearest shops found by the farmer app's search. New shops (not seen
// before, matched by Google placeId or name) are added with a full demo
// product inventory, and about half of them also get an equipment owner.
// Already-known shops are left completely untouched.
router.post('/sync-shops', async (req, res) => {
  try {
    const incoming = Array.isArray(req.body.shops) ? req.body.shops.slice(0, 10) : [];
    if (incoming.length === 0) {
      const current = await readVendorShops();
      return res.json({ success: true, data: current.shops.filter(s => s.active !== false), added: 0 });
    }

    const vendorData = await readVendorShops();
    let shops = vendorData.shops || [];

    // First-ever real sync: drop the 4 hardcoded demo shops for real ones.
    if (!vendorData.replaced) {
      shops = [];
      vendorData.replaced = true;
    }

    const catalogData = await readCatalog();
    const ownersData = await readOwners();
    ownersData.owners = ownersData.owners || [];
    catalogData.products = catalogData.products || [];

    let nextNum = vendorData.nextShopNum || 5;
    let addedCount = 0;

    // Every sync reflects "today's nearest 10". Start by hiding everyone,
    // then re-show (or create) exactly the shops in this fresh search —
    // old shops that drop out of range stay saved, just hidden from the
    // dropdown, and pop back with all their old data if they return later.
    for (const s of shops) s.active = false;

    // Deterministic fleet rule (index = position in the nearest-10 list,
    // sorted nearest first): shops 1-8 get a machine owner, the last 2 don't.
    for (let idx = 0; idx < incoming.length; idx++) {
      const inc = incoming[idx];
      if (!inc || !inc.name) continue;
      const nameKey = inc.name.trim().toLowerCase();
      let shop = shops.find(s =>
        (inc.placeId && s.placeId && s.placeId === inc.placeId) ||
        (s.name || '').trim().toLowerCase() === nameKey
      );

      if (shop) {
        shop.active = true; // Reactivate — leave all its saved data untouched
        // Backfill real coordinates for shops synced before this was tracked
        if (!shop.coords && inc.location) shop.coords = inc.location;
      } else {
        const id = `SHOP-${String(nextNum).padStart(3, '0')}`;
        nextNum++;

        shop = {
          id,
          name: inc.name,
          location: inc.address || inc.name,
          coords: inc.location || null, // real GPS position, used for the delivery-tracking map
          phone: randomPhone(),
          license: `AG-KA-${Math.floor(10000 + Math.random() * 89999)}`,
          placeId: inc.placeId || null,
          active: true
        };
        shops.push(shop);
        addedCount++;

        // Same demo product catalog, all marked in stock for the new shop
        for (const p of catalogData.products) {
          if (!p.stockByShop) p.stockByShop = {};
          p.stockByShop[id] = true;
        }
      }

      const shouldHaveOwner = idx < 8;
      const hasOwner = ownersData.owners.some(o => o.shopId === shop.id);

      if (shouldHaveOwner && !hasOwner) {
        const pick = randomPick(MACHINE_TYPES);
        ownersData.owners.push({
          id: `OWN-${Math.floor(100 + Math.random() * 900)}`,
          shopId: shop.id,
          shopName: shop.name,
          ownerName: `${randomPick(FIRST_NAMES)} ${randomPick(LAST_NAMES)}`,
          ownerPhone: randomPhone(),
          machineType: pick.type,
          machineName: randomPick(pick.names),
          location: shop.location,
          available: true,
          rating: Number((4.3 + Math.random() * 0.6).toFixed(1)),
          totalRentals: Math.floor(5 + Math.random() * 30)
        });
      } else if (!shouldHaveOwner && hasOwner) {
        // Last 2 in the list stay empty, per the "index wise" rule
        ownersData.owners = ownersData.owners.filter(o => o.shopId !== shop.id);
      }
    }

    // Drop owners left over from shops that no longer exist at all (e.g. the
    // old demo shops replaced on first sync) — keeps equipmentOwners.json tidy.
    ownersData.owners = ownersData.owners.filter(o => shops.some(s => s.id === o.shopId));

    vendorData.shops = shops;
    vendorData.nextShopNum = nextNum;
    await writeVendorShops(vendorData);
    await writeCatalog(catalogData);
    await writeOwners(ownersData);

    res.json({ success: true, data: shops.filter(s => s.active !== false), added: addedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
