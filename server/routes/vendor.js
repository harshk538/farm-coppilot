import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const ordersPath = path.join(process.cwd(), 'data', 'orders.json');
const catalogPath = path.join(process.cwd(), 'data', 'productCatalog.json');

const SHOPS_LIST = [
  { id: 'SHOP-001', name: 'Shree Agro Suppliers', location: 'Kumbalgodu, Bengaluru', phone: '+91 98765 43210', license: 'AG-KA-88219' },
  { id: 'SHOP-002', name: 'Sri Chamundeshwari Fertilizers', location: 'Kengeri, Bengaluru', phone: '+91 99887 76655', license: 'AG-KA-99120' },
  { id: 'SHOP-003', name: 'Hassan Agro Bio Tech', location: 'Bannerghatta, Bengaluru', phone: '+91 97766 55443', license: 'AG-KA-77312' },
  { id: 'SHOP-004', name: 'Venkateshwara Krishi Kendra', location: 'Tavarekere, Bengaluru', phone: '+91 96655 44332', license: 'AG-KA-66415' }
];

// Helper to read orders
const readOrders = () => {
  try {
    if (!fs.existsSync(ordersPath)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(ordersPath, 'utf8')).orders || [];
  } catch (err) {
    console.error("Error reading orders.json:", err.message);
    return [];
  }
};

// Helper to write orders
const writeOrders = (orders) => {
  try {
    fs.writeFileSync(ordersPath, JSON.stringify({ orders }, null, 2));
  } catch (err) {
    console.error("Error writing orders.json:", err.message);
  }
};

// GET active shops list
router.get('/shops', (req, res) => {
  res.json({ success: true, data: SHOPS_LIST });
});

// GET all orders
router.get('/orders', (req, res) => {
  const orders = readOrders();
  res.json({ success: true, data: orders });
});

// POST new order (Broadcasted by Farmer to all local shops)
router.post('/orders', (req, res) => {
  try {
    const { farmerName, farmerPhone, location, items } = req.body;
    const orders = readOrders();

    const totalAmount = (items || []).reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);

    // Auto-sync ordered items into Product Catalog if not present
    try {
      if (fs.existsSync(catalogPath)) {
        const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        let catalogProducts = catalogData.products || [];
        let updated = false;

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
              verified: true,
              whyThis: 'AI recommended treatment for crop protection'
            });
            updated = true;
          }
        }

        if (updated) {
          catalogData.products = catalogProducts;
          fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2));
        }
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
    writeOrders(orders);

    res.json({ success: true, data: newOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH order status (Confirm / Claim, Reject, Ready for Pickup)
router.patch('/orders/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, shopId, shopName, shopPhone } = req.body;
    const orders = readOrders();

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
    writeOrders(orders);

    res.json({ success: true, data: targetOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE order (Cancel Order by Farmer)
router.delete('/orders/:id', (req, res) => {
  try {
    const { id } = req.params;
    let orders = readOrders();

    const orderExists = orders.some(o => o.id === id);
    if (!orderExists) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    orders = orders.filter(o => o.id !== id);
    writeOrders(orders);

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Vendor products with stock status
router.get('/products', (req, res) => {
  try {
    const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const products = catalogData.products || [];
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH toggle product stock status
router.patch('/products/:id/stock', (req, res) => {
  try {
    const { id } = req.params;
    const { inStock } = req.body;

    const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const products = catalogData.products || [];

    const prod = products.find(p => p.id === id);
    if (prod) {
      prod.inStock = inStock;
      fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2));
    }

    res.json({ success: true, data: prod });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET Vendor Stats Overview
router.get('/stats', (req, res) => {
  const { shopId } = req.query;
  const orders = readOrders();
  const pending = orders.filter(o => o.status === 'pending').length;
  
  // Filter confirmed orders for specific shop or all
  const shopOrders = shopId 
    ? orders.filter(o => o.claimedByShopId === shopId)
    : orders.filter(o => o.status === 'confirmed' || o.status === 'ready');

  const confirmed = shopOrders.filter(o => o.status === 'confirmed' || o.status === 'ready').length;
  const totalRevenue = shopOrders
    .filter(o => o.status === 'confirmed' || o.status === 'ready')
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

export default router;
