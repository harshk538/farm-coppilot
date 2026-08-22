import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const router = express.Router();

const typesPath = path.join(process.cwd(), 'data', 'equipmentTypes.json');
const ownersPath = path.join(process.cwd(), 'data', 'equipmentOwners.json');
const requestsPath = path.join(process.cwd(), 'data', 'equipmentRequests.json');

// Read JSON Helper
const readJSON = (filePath, fallbackKey) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data[fallbackKey] || [];
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return [];
  }
};

// Write JSON Helper
const writeJSON = (filePath, key, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify({ [key]: data }, null, 2));
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
  }
};

// Helper: Send Real Fast2SMS Notifications to Equipment Owners
const sendSMSNotification = async (requestObj) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log('[SMS Skip] No FAST2SMS_API_KEY set in .env');
    return;
  }

  const phoneNumbers = '7070799420,6299994578';
  const calculatePayout = Math.round((requestObj.landAreaAcres || 1) * 500 * 0.9);
  
  // Quick Accept Link pointing to backend route that auto-accepts and redirects to app
  const quickAcceptUrl = `http://localhost:5005/api/equipment/quick-accept/${requestObj.id}/OWN-101`;

  const messageText = `Farm Copilot Job Alert: ${requestObj.equipmentTypeName} needed for ${requestObj.landAreaAcres} Acres at ${requestObj.location}. Payout: Rs.${calculatePayout}. Tap to ACCEPT: ${quickAcceptUrl}`;

  try {
    console.log(`[Fast2SMS] Triggering SMS to numbers: ${phoneNumbers}...`);
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: apiKey,
        route: 'v3',
        sender_id: 'TXTIND',
        message: messageText,
        language: 'english',
        flash: 0,
        numbers: phoneNumbers
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
          numbers: phoneNumbers
        }
      });
      console.log('✅ Fast2SMS Fallback Quick Route Result:', fallbackRes.data);
    } catch (e) {
      console.error('❌ Fast2SMS Fallback Error:', e.response?.data || e.message);
    }
  }
};

// GET equipment types
router.get('/types', (req, res) => {
  const types = readJSON(typesPath, 'equipmentTypes');
  res.json({ success: true, data: types });
});

// GET rental requests
router.get('/requests', (req, res) => {
  const requests = readJSON(requestsPath, 'requests');
  res.json({ success: true, data: requests });
});

// POST new rental request (Farmer App)
router.post('/requests', (req, res) => {
  try {
    const { farmerName, farmerPhone, location, equipmentTypeId, workType, landAreaAcres, requiredDate, preferredTime } = req.body;
    const requests = readJSON(requestsPath, 'requests');
    const types = readJSON(typesPath, 'equipmentTypes');

    const typeObj = types.find(t => t.id === equipmentTypeId) || { name: 'Farm Equipment' };

    const newRequest = {
      id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      farmerName: farmerName || 'Local Farmer',
      farmerPhone: farmerPhone || '+91 98765 00000',
      location: location || 'Kumbalgodu, Bengaluru',
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
    writeJSON(requestsPath, 'requests', requests);

    // Trigger Real Fast2SMS Notification to 7070799420 and 6299994578
    sendSMSNotification(newRequest);

    res.json({ success: true, data: newRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Quick Accept Link (From SMS Click)
router.get('/quick-accept/:id/:ownerId', (req, res) => {
  try {
    const { id, ownerId } = req.params;
    const requests = readJSON(requestsPath, 'requests');
    const owners = readJSON(ownersPath, 'owners');
    const types = readJSON(typesPath, 'equipmentTypes');

    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex !== -1) {
      const targetReq = requests[reqIndex];
      const ownerObj = owners.find(o => o.id === ownerId) || owners[0];

      if (ownerObj) {
        const typeObj = types.find(t => t.id === targetReq.equipmentTypeId) || { defaultRate: 500 };
        const unitRate = typeObj.defaultRate || 500;
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
        writeJSON(requestsPath, 'requests', requests);
      }
    }

    res.redirect('http://localhost:5173/equipment?smsAccepted=true');
  } catch (err) {
    res.redirect('http://localhost:5173/equipment');
  }
});

// POST vendor quote (Vendor App assigns machine owner)
router.post('/requests/:id/quote', (req, res) => {
  try {
    const { id } = req.params;
    const { shopId, shopName, shopPhone, ownerId } = req.body;
    
    const requests = readJSON(requestsPath, 'requests');
    const owners = readJSON(ownersPath, 'owners');
    const types = readJSON(typesPath, 'equipmentTypes');

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

    const unitRate = typeObj.defaultRate || 500;
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

    writeJSON(requestsPath, 'requests', requests);

    res.json({ success: true, data: targetReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Equipment Owner accepts Job Ping directly (Owner App / Copilot Hub)
router.post('/requests/:id/owner-accept', (req, res) => {
  try {
    const { id } = req.params;
    const { ownerId } = req.body;

    const requests = readJSON(requestsPath, 'requests');
    const owners = readJSON(ownersPath, 'owners');
    const types = readJSON(typesPath, 'equipmentTypes');

    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const targetReq = requests[reqIndex];
    const ownerObj = owners.find(o => o.id === ownerId);
    if (!ownerObj) {
      return res.status(400).json({ success: false, message: 'Owner profile not found' });
    }

    const typeObj = types.find(t => t.id === targetReq.equipmentTypeId) || { defaultRate: 500 };
    const unitRate = typeObj.defaultRate || 500;
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

    writeJSON(requestsPath, 'requests', requests);

    res.json({ success: true, data: targetReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST farmer accepts a vendor quote (Farmer App)
router.post('/requests/:id/accept', (req, res) => {
  try {
    const { id } = req.params;
    const { quoteId } = req.body;

    const requests = readJSON(requestsPath, 'requests');
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

    writeJSON(requestsPath, 'requests', requests);

    res.json({ success: true, data: targetReq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE rental request (Farmer App)
router.delete('/requests/:id', (req, res) => {
  try {
    const { id } = req.params;
    let requests = readJSON(requestsPath, 'requests');

    const exists = requests.some(r => r.id === id);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    requests = requests.filter(r => r.id !== id);
    writeJSON(requestsPath, 'requests', requests);

    res.json({ success: true, message: 'Rental request cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET registered equipment owners (Vendor Fleet)
router.get('/owners', (req, res) => {
  const { shopId } = req.query;
  let owners = readJSON(ownersPath, 'owners');
  if (shopId) {
    owners = owners.filter(o => o.shopId === shopId);
  }
  res.json({ success: true, data: owners });
});

// POST add new owner to vendor fleet
router.post('/owners', (req, res) => {
  try {
    const { shopId, shopName, ownerName, ownerPhone, machineType, machineName, location } = req.body;
    const owners = readJSON(ownersPath, 'owners');

    const newOwner = {
      id: `OWN-${Math.floor(100 + Math.random() * 900)}`,
      shopId: shopId || 'SHOP-001',
      shopName: shopName || 'Shree Agro Suppliers',
      ownerName: ownerName || 'Local Machine Owner',
      ownerPhone: ownerPhone || '+91 98765 00000',
      machineType: machineType || 'EQ-TRAC',
      machineName: machineName || 'Farm Tractor',
      location: location || 'Kumbalgodu, Bengaluru',
      available: true,
      rating: 4.8,
      totalRentals: 0
    };

    owners.unshift(newOwner);
    writeJSON(ownersPath, 'owners', owners);

    res.json({ success: true, data: newOwner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle owner availability
router.patch('/owners/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;

    const owners = readJSON(ownersPath, 'owners');
    const owner = owners.find(o => o.id === id);
    if (owner) {
      owner.available = available;
      writeJSON(ownersPath, 'owners', owners);
    }

    res.json({ success: true, data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
