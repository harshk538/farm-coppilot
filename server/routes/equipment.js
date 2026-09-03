import express from 'express';
import axios from 'axios';
import { geocodeAddress, haversineKm } from '../utils/geo.js';
import { readCollection, readConfig, writeConfig } from '../utils/mongoStore.js';

const router = express.Router();

// Owner-direct "I Own Machinery" job pings only reach owners within this radius.
const OWNER_JOB_RADIUS_KM = 7;
// Cap on how many machines one farmer account can register directly.
const MAX_MACHINES_PER_FARMER = 5;

// Read/write helper — now Mongo-backed instead of file-backed. `collection`
// is the Mongo collection name (equipmentTypes / equipmentOwners /
// equipmentRequests — all "config" collections, see utils/mongoStore.js),
// `key` is the field that array lives under in that collection's single
// document (e.g. { requests: [...] }).
const readJSON = async (collection, key) => {
  try {
    const doc = await readConfig(collection, { [key]: [] });
    return doc[key] || [];
  } catch (e) {
    console.error(`Error reading ${collection}:`, e.message);
    return [];
  }
};

const writeJSON = async (collection, key, data) => {
  try {
    await writeConfig(collection, { [key]: data });
  } catch (e) {
    console.error(`Error writing ${collection}:`, e.message);
  }
};

// Helper: Send Real Fast2SMS Notifications to Equipment Owners
// Only owners with a matching machine type AND within OWNER_JOB_RADIUS_KM of the
// farmer's request get pinged — this is the real 7km "I Own Machinery" network,
// separate from the vendor-mediated Rent Equipment flow.
const sendSMSNotification = async (requestObj) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log('[SMS Skip] No FAST2SMS_API_KEY set in .env');
    return;
  }

  const owners = await readJSON('equipmentOwners', 'owners');
  const nearbyOwners = owners.filter(o =>
    o.available &&
    o.machineType === requestObj.equipmentTypeId &&
    requestObj.coords &&
    haversineKm(o.coords, requestObj.coords) <= OWNER_JOB_RADIUS_KM
  );

  if (nearbyOwners.length === 0) {
    console.log(`[SMS Skip] No available ${requestObj.equipmentTypeName} owners within ${OWNER_JOB_RADIUS_KM}km`);
    return;
  }

  const calculatePayout = Math.round((requestObj.landAreaAcres || 1) * 500 * 0.9);

  for (const owner of nearbyOwners) {
    const phone = (owner.ownerPhone || '').replace(/\D/g, '').slice(-10);
    if (!phone) continue;

    // Quick Accept Link pointing to backend route that auto-accepts and redirects to app
    const publicDomain = process.env.PUBLIC_URL || 'https://pointless-crusher-preaching.ngrok-free.dev';
    const quickAcceptUrl = `${publicDomain}/api/equipment/quick-accept/${requestObj.id}/${owner.id}`;
    const messageText = `Farm Copilot Job Alert: ${requestObj.equipmentTypeName} needed for ${requestObj.landAreaAcres} Acres at ${requestObj.location}. Payout: Rs.${calculatePayout}. Tap to ACCEPT: ${quickAcceptUrl}`;

    try {
      console.log(`[Fast2SMS] Triggering SMS to ${owner.ownerName} (${phone})...`);
      const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: apiKey,
          route: 'v3',
          sender_id: 'TXTIND',
          message: messageText,
          language: 'english',
          flash: 0,
          numbers: phone
        }
      });
      console.log('✅ Fast2SMS Dispatch Result:', response.data);
    } catch (error) {
      console.error('❌ Fast2SMS Dispatch Error:', error.response?.data || error.message);
      // Retry with fallback quick route if v3 route fails
      try {
        const fallbackRes = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
          params: {
            authorization: apiKey,
            route: 'q',
            message: messageText,
            language: 'english',
            flash: 0,
            numbers: phone
          }
        });
        console.log('✅ Fast2SMS Fallback Quick Route Result:', fallbackRes.data);
      } catch (e) {
        console.error('❌ Fast2SMS Fallback Error:', e.response?.data || e.message);
      }
    }
  }
};

// Simulated delivery duration for the demo tracking map (kept in sync with the frontend's DELIVERY_DURATION_MS)
const DELIVERY_DURATION_MS = 2 * 60 * 1000; // 2 minutes

// Helper: Notify the farmer by SMS once the (simulated) delivery has arrived
const sendDeliveryArrivedSMS = async (requestObj) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log('[SMS Skip] No FAST2SMS_API_KEY set in .env');
    return;
  }
  const phone = (requestObj.farmerPhone || '').replace(/\D/g, '').slice(-10);
  if (!phone) return;

  const messageText = `Farm Copilot: Your ${requestObj.acceptedQuote?.machineName || 'equipment'} has arrived at your location for ${requestObj.id}. Driver: ${requestObj.acceptedQuote?.ownerName || ''}.`;

  try {
    console.log(`[Fast2SMS] Sending delivery-arrived SMS to ${phone}...`);
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
    console.log('✅ Fast2SMS Delivery-Arrived Result:', response.data);
  } catch (error) {
    console.error('❌ Fast2SMS Delivery-Arrived Error:', error.response?.data || error.message);
  }
};

// Background check: runs independently of any open browser tab, so the "delivery" keeps
// progressing and the farmer gets notified even if no one has the tracking map open.
setInterval(async () => {
  try {
    const requests = await readJSON('equipmentRequests', 'requests');
    let changed = false;
    const now = Date.now();

    for (const r of requests) {
      if (r.status === 'booked' && r.acceptedQuote && r.bookedAt && !r.deliveryNotifiedAt) {
        const elapsed = now - new Date(r.bookedAt).getTime();
        if (elapsed >= DELIVERY_DURATION_MS) {
          r.deliveryNotifiedAt = new Date().toISOString();
          changed = true;
          sendDeliveryArrivedSMS(r);
        }
      }
    }

    if (changed) await writeJSON('equipmentRequests', 'requests', requests);
  } catch (e) {
    console.error('Delivery-arrival check failed:', e.message);
  }
}, 15000);

// GET equipment types
router.get('/types', async (req, res) => {
  const types = await readJSON('equipmentTypes', 'equipmentTypes');
  res.json({ success: true, data: types });
});

// GET rental requests
router.get('/requests', async (req, res) => {
  const requests = await readJSON('equipmentRequests', 'requests');
  res.json({ success: true, data: requests });
});

// POST new rental request (Farmer App)
router.post('/requests', async (req, res) => {
  try {
    const { farmerName, farmerPhone, location, equipmentTypeId, workType, landAreaAcres, requiredDate, preferredTime } = req.body;
    const requests = await readJSON('equipmentRequests', 'requests');
    const types = await readJSON('equipmentTypes', 'equipmentTypes');

    const typeObj = types.find(t => t.id === equipmentTypeId) || { name: 'Farm Equipment' };
    const finalLocation = location || 'Kumbalgodu, Bengaluru';

    // Real coordinates for this request, so nearby owners can be matched by real distance
    const coords = await geocodeAddress(finalLocation);

    const newRequest = {
      id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      farmerName: farmerName || 'Local Farmer',
      farmerPhone: farmerPhone || '+91 98765 00000',
      location: finalLocation,
      coords,
      equipmentTypeId: equipmentTypeId || 'EQ-TRAC',
      equipmentTypeName: typeObj.name,
      workType: workType || 'Ploughing',
      landAreaAcres: Number(landAreaAcres) || 1,
      requiredDate: requiredDate || 'Tomorrow',
      preferredTime: preferredTime || '08:00 AM - 02:00 PM',
      status: 'pending_quotes',
      requestedAt: new Date().toISOString(),
      quotes: []
    };

    requests.unshift(newRequest);
    await writeJSON('equipmentRequests', 'requests', requests);

    // Real job-ping: only owners of the matching machine type within 7km get texted
    sendSMSNotification(newRequest);

    res.json({ success: true, data: newRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Quick Accept Link (From SMS Click)
router.get('/quick-accept/:id/:ownerId', async (req, res) => {
  try {
    const { id, ownerId } = req.params;
    const requests = await readJSON('equipmentRequests', 'requests');
    const owners = await readJSON('equipmentOwners', 'owners');
    const types = await readJSON('equipmentTypes', 'equipmentTypes');

    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex !== -1) {
      const targetReq = requests[reqIndex];
      const ownerObj = owners.find(o => o.id === ownerId) || owners[0];

      // Job already booked by the farmer (someone else accepted faster) —
      // this late click is silently ignored, no duplicate/late quote added.
      if (ownerObj && targetReq.status !== 'booked') {
        const typeObj = types.find(t => t.id === targetReq.equipmentTypeId) || { defaultRate: 500 };
        const unitRate = ownerObj.biddingPrice || typeObj.defaultRate || 500;
        const calculatedPrice = (targetReq.landAreaAcres || 1) * unitRate;
        const ownerShare = Math.round(calculatedPrice * 0.9);
        const vendorCommission = calculatedPrice - ownerShare;

        const newQuote = {
          quoteId: `Q-${Math.floor(100 + Math.random() * 900)}`,
          shopId: ownerObj.shopId || 'SHOP-001',
          shopName: ownerObj.shopName || 'Shree Agro Suppliers Fleet',
          shopPhone: '+91 98765 43210',
          ownerId: ownerObj.id,
          ownerName: ownerObj.ownerName,
          machineName: ownerObj.machineName,
          calculatedPrice,
          ownerShare,
          vendorCommission,
          distanceKm: '2.1 km',
          rating: ownerObj.rating || 4.9,
          acceptedByOwner: true,
          quotedAt: new Date().toISOString()
        };

        targetReq.quotes = targetReq.quotes.filter(q => q.ownerId !== ownerObj.id);
        targetReq.quotes.push(newQuote);
        await writeJSON('equipmentRequests', 'requests', requests);
      }
    }

    res.redirect('http://localhost:5173/equipment?smsAccepted=true');
  } catch (err) {
    res.redirect('http://localhost:5173/equipment');
  }
});

// POST vendor quote (Vendor App assigns machine owner)
router.post('/requests/:id/quote', async (req, res) => {
  try {
    const { id } = req.params;
    const { shopId, shopName, shopPhone, ownerId } = req.body;
    
    const requests = await readJSON('equipmentRequests', 'requests');
    const owners = await readJSON('equipmentOwners', 'owners');
    const types = await readJSON('equipmentTypes', 'equipmentTypes');

    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const targetReq = requests[reqIndex];
    const ownerObj = owners.find(o => o.id === ownerId);
    if (!ownerObj) {
      return res.status(400).json({ success: false, message: 'Selected machine owner not found' });
    }

    const typeObj = types.find(t => t.id === targetReq.equipmentTypeId) || { defaultRate: 500 };

    const unitRate = ownerObj.biddingPrice || typeObj.defaultRate || 500;
    const calculatedPrice = (targetReq.landAreaAcres || 1) * unitRate;
    const ownerShare = Math.round(calculatedPrice * 0.9);
    const vendorCommission = calculatedPrice - ownerShare;

    const existingQuoteIndex = targetReq.quotes.findIndex(q => q.shopId === shopId);

    const newQuote = {
      quoteId: `Q-${Math.floor(100 + Math.random() * 900)}`,
      shopId: shopId || 'SHOP-001',
      shopName: shopName || ownerObj.shopName || 'Shree Agro Suppliers',
      shopPhone: shopPhone || '+91 98765 43210',
      ownerId: ownerObj.id,
      ownerName: ownerObj.ownerName,
      machineName: ownerObj.machineName,
      calculatedPrice,
      ownerShare,
      vendorCommission,
      distanceKm: `${(2.5 + Math.random() * 3).toFixed(1)} km`,
      rating: ownerObj.rating || 4.8,
      quotedAt: new Date().toISOString()
    };

    if (existingQuoteIndex >= 0) {
      targetReq.quotes[existingQuoteIndex] = newQuote;
    } else {
      targetReq.quotes.push(newQuote);
    }

    await writeJSON('equipmentRequests', 'requests', requests);

    res.json({ success: true, data: targetReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Equipment Owner accepts Job Ping directly (Owner App / Copilot Hub)
router.post('/requests/:id/owner-accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerId } = req.body;

    const requests = await readJSON('equipmentRequests', 'requests');
    const owners = await readJSON('equipmentOwners', 'owners');
    const types = await readJSON('equipmentTypes', 'equipmentTypes');

    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const targetReq = requests[reqIndex];
    const ownerObj = owners.find(o => o.id === ownerId);
    if (!ownerObj) {
      return res.status(400).json({ success: false, message: 'Owner profile not found' });
    }

    // Job already booked by the farmer (someone else's acceptance came in
    // faster) — silently ignore this late accept, don't touch the request.
    if (targetReq.status === 'booked') {
      return res.json({ success: true, data: targetReq });
    }

    const typeObj = types.find(t => t.id === targetReq.equipmentTypeId) || { defaultRate: 500 };
    const unitRate = ownerObj.biddingPrice || typeObj.defaultRate || 500;
    const calculatedPrice = (targetReq.landAreaAcres || 1) * unitRate;
    const ownerShare = Math.round(calculatedPrice * 0.9);
    const vendorCommission = calculatedPrice - ownerShare;

    const newQuote = {
      quoteId: `Q-${Math.floor(100 + Math.random() * 900)}`,
      shopId: ownerObj.shopId || 'SHOP-001',
      shopName: ownerObj.shopName || 'Shree Agro Suppliers Fleet',
      shopPhone: '+91 98765 43210',
      ownerId: ownerObj.id,
      ownerName: ownerObj.ownerName,
      machineName: ownerObj.machineName,
      calculatedPrice,
      ownerShare,
      vendorCommission,
      distanceKm: `${(1.8 + Math.random() * 2).toFixed(1)} km`,
      rating: ownerObj.rating || 4.9,
      acceptedByOwner: true,
      quotedAt: new Date().toISOString()
    };

    targetReq.quotes = targetReq.quotes.filter(q => q.ownerId !== ownerObj.id);
    targetReq.quotes.push(newQuote);

    await writeJSON('equipmentRequests', 'requests', requests);

    res.json({ success: true, data: targetReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST farmer accepts a vendor quote (Farmer App)
router.post('/requests/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { quoteId } = req.body;

    const requests = await readJSON('equipmentRequests', 'requests');
    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return res.status(404).json({ success: false, message: 'Rental request not found' });
    }

    const targetReq = requests[reqIndex];
    const acceptedQuote = targetReq.quotes.find(q => q.quoteId === quoteId);
    if (!acceptedQuote) {
      return res.status(400).json({ success: false, message: 'Selected quote not found' });
    }

    targetReq.status = 'booked';
    targetReq.acceptedQuote = acceptedQuote;
    targetReq.bookedAt = new Date().toISOString();

    await writeJSON('equipmentRequests', 'requests', requests);

    res.json({ success: true, data: targetReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE rental request (Farmer App)
router.delete('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let requests = await readJSON('equipmentRequests', 'requests');

    const exists = requests.some(r => r.id === id);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    requests = requests.filter(r => r.id !== id);
    await writeJSON('equipmentRequests', 'requests', requests);

    res.json({ success: true, message: 'Rental request cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET registered equipment owners (Vendor Fleet)
router.get('/owners', async (req, res) => {
  const { shopId } = req.query;
  let owners = await readJSON('equipmentOwners', 'owners');
  if (shopId) {
    owners = owners.filter(o => o.shopId === shopId);
  }
  res.json({ success: true, data: owners });
});

// POST add new owner to vendor fleet
// POST a farmer's own machine, registered directly (no vendor involved) — the
// "I Own Machinery" peer network. The machine's address must be within
// OWNER_JOB_RADIUS_KM of the farmer's own field location (set at signup), so
// this stays a real hyperlocal network and not just anyone anywhere.
router.post('/owners/self-register', async (req, res) => {
  try {
    const { farmerId, farmerName, farmerPhone, machineType, machineName, location, coords: pickedCoords, biddingPrice } = req.body;

    if (!farmerId || !machineName || !location) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const existingOwners = await readJSON('equipmentOwners', 'owners');
    const myMachineCount = existingOwners.filter(o => o.farmerId === farmerId).length;
    if (myMachineCount >= MAX_MACHINES_PER_FARMER) {
      return res.status(400).json({ success: false, message: `You can register up to ${MAX_MACHINES_PER_FARMER} machines per account.` });
    }

    const users = await readCollection('users', []);
    const farmer = users.find(u => u.id === farmerId);
    if (!farmer || !farmer.fieldLocationCoords) {
      return res.status(400).json({ success: false, message: 'Your field location is missing. Please log out and sign up again with a field location.' });
    }

    // An exact point from GPS or the map picker is used as-is. Only a typed
    // address needs geocoding, and that is biased toward the farmer's own known
    // location — otherwise a common place name (e.g. "Somanahalli") can resolve
    // to a same-named place elsewhere in the state instead of the one nearby.
    const coords = (pickedCoords && typeof pickedCoords.lat === 'number' && typeof pickedCoords.lng === 'number')
      ? { lat: pickedCoords.lat, lng: pickedCoords.lng }
      : await geocodeAddress(location, farmer.fieldLocationCoords);
    if (!coords) {
      return res.status(400).json({ success: false, message: 'Could not locate that address. Please check and try again.' });
    }

    const distKm = haversineKm(farmer.fieldLocationCoords, coords);
    if (distKm > OWNER_JOB_RADIUS_KM) {
      return res.status(400).json({
        success: false,
        message: `This address is about ${distKm.toFixed(1)} km from your field location. It must be within ${OWNER_JOB_RADIUS_KM} km to register.`
      });
    }

    const owners = await readJSON('equipmentOwners', 'owners');
    const newOwner = {
      id: `OWN-${Math.floor(100 + Math.random() * 900)}`,
      farmerId,
      shopId: null,
      shopName: 'Direct (Farmer Network)',
      ownerName: farmerName || farmer.name || 'Local Machine Owner',
      ownerPhone: farmerPhone || farmer.phone || '',
      machineType: machineType || 'EQ-TRAC',
      machineName,
      location,
      coords,
      biddingPrice: biddingPrice ? Math.max(0, Number(biddingPrice)) : null,
      available: true,
      rating: 4.8,
      totalRentals: 0
    };

    owners.unshift(newOwner);
    await writeJSON('equipmentOwners', 'owners', owners);

    res.json({ success: true, data: newOwner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/owners', async (req, res) => {
  try {
    const { shopId, shopName, ownerName, ownerPhone, machineType, machineName, location, biddingPrice } = req.body;
    const owners = await readJSON('equipmentOwners', 'owners');
    const finalLocation = location || 'Kumbalgodu, Bengaluru';

    // Bias the geocode toward this shop's own location — otherwise a common
    // place name can resolve to a same-named place elsewhere in the state.
    let shopCoords = null;
    try {
      const vendorData = await readConfig('vendorShops', { shops: [] });
      shopCoords = (vendorData.shops || []).find(s => s.id === shopId)?.coords || null;
    } catch (e) {
      shopCoords = null;
    }

    // Real coordinates for this owner, so the 7km "I Own Machinery" job-ping
    // radius can be checked against their actual location.
    const coords = await geocodeAddress(finalLocation, shopCoords);

    const newOwner = {
      id: `OWN-${Math.floor(100 + Math.random() * 900)}`,
      shopId: shopId || 'SHOP-001',
      shopName: shopName || 'Shree Agro Suppliers',
      ownerName: ownerName || 'Local Machine Owner',
      ownerPhone: ownerPhone || '+91 98765 00000',
      machineType: machineType || 'EQ-TRAC',
      machineName: machineName || 'Farm Tractor',
      location: finalLocation,
      coords,
      // The price this owner is bidding to rent their machine at — lets multiple
      // owners of the same machine type compete on price for the same request.
      biddingPrice: biddingPrice ? Number(biddingPrice) : null,
      available: true,
      rating: 4.8,
      totalRentals: 0
    };

    owners.unshift(newOwner);
    await writeJSON('equipmentOwners', 'owners', owners);

    res.json({ success: true, data: newOwner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH update an owner's own details (Manage button in vendor Fleet & Owners)
router.patch('/owners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerName, ownerPhone, machineType, machineName, location, biddingPrice } = req.body;

    const owners = await readJSON('equipmentOwners', 'owners');
    const owner = owners.find(o => o.id === id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    if (ownerName !== undefined) owner.ownerName = ownerName;
    if (ownerPhone !== undefined) owner.ownerPhone = ownerPhone;
    if (machineType !== undefined) owner.machineType = machineType;
    if (machineName !== undefined) owner.machineName = machineName;
    // Location changed — re-geocode so the 7km job-ping radius stays accurate.
    // Bias toward the owner's previous coordinates (a location edit is almost
    // always nearby) so a common place name doesn't resolve elsewhere.
    if (location !== undefined && location !== owner.location) {
      const biasCoords = owner.coords || null;
      owner.location = location;
      owner.coords = await geocodeAddress(location, biasCoords);
    }
    if (biddingPrice !== undefined) owner.biddingPrice = biddingPrice ? Number(biddingPrice) : null;

    await writeJSON('equipmentOwners', 'owners', owners);
    res.json({ success: true, data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle owner availability
router.patch('/owners/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;

    const owners = await readJSON('equipmentOwners', 'owners');
    const owner = owners.find(o => o.id === id);
    if (owner) {
      owner.available = available;
      await writeJSON('equipmentOwners', 'owners', owners);
    }

    res.json({ success: true, data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
