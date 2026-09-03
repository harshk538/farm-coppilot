import express from 'express';
import { geocodeAddress } from '../utils/geo.js';
import { readCollection, writeCollection } from '../utils/mongoStore.js';

const router = express.Router();

// A farmer can keep several fields under one account. Each farm carries its own
// location, its own crop, and (from Step 2 onward) its own soil-test history.
const MAX_FARMS_PER_FARMER = 10;

// Now backed by MongoDB ("farms" / "users" collections) instead of the JSON
// files — same read-all-as-array shape the rest of this file already expects.
const readFarms = () => readCollection('farms', []);
const readUsers = () => readCollection('users', []);
const writeFarms = (farms) => writeCollection('farms', farms);

// The field location captured at signup becomes the farmer's "Farm 1" the first
// time they open the Farms page, so nobody starts with an empty list.
const ensureFirstFarm = async (farmerId) => {
  const farms = await readFarms();
  const mine = farms.filter(f => f.farmerId === farmerId);
  if (mine.length > 0) return farms;

  const users = await readUsers();
  const user = users.find(u => u.id === farmerId);
  if (!user || !user.fieldLocation) return farms;

  farms.push({
    id: `FARM-${Date.now()}`,
    farmerId,
    name: 'Farm 1',
    location: user.fieldLocation,
    coords: user.fieldLocationCoords || null,
    currentCrop: '',
    cropStartDate: null,
    cropHistory: [],
    createdAt: new Date().toISOString(),
  });
  await writeFarms(farms);
  return farms;
};

// ── GET /api/farms?farmerId=...  (list a farmer's farms) ───────────────────
router.get('/', async (req, res) => {
  const { farmerId } = req.query;
  if (!farmerId) return res.status(400).json({ success: false, message: 'farmerId is required.' });

  const farms = await ensureFirstFarm(farmerId);
  const mine = farms.filter(f => f.farmerId === farmerId);
  res.json({ success: true, farms: mine, maxFarms: MAX_FARMS_PER_FARMER });
});

// ── POST /api/farms  (add another farm) ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { farmerId, name, location, coords, currentCrop } = req.body;
    if (!farmerId || !location || !String(location).trim()) {
      return res.status(400).json({ success: false, message: 'Farm location is required.' });
    }

    const farms = await readFarms();
    const mine = farms.filter(f => f.farmerId === farmerId);
    if (mine.length >= MAX_FARMS_PER_FARMER) {
      return res.status(400).json({ success: false, message: `You can add up to ${MAX_FARMS_PER_FARMER} farms.` });
    }

    // Exact coordinates from GPS or the map picker win; a typed address is
    // geocoded instead, biased towards the farmer's existing farms so common
    // village names resolve nearby rather than to a same-named place far away.
    let finalCoords = null;
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      finalCoords = { lat: coords.lat, lng: coords.lng };
    } else {
      const bias = mine.find(f => f.coords)?.coords || null;
      finalCoords = await geocodeAddress(String(location).trim(), bias);
    }

    const newFarm = {
      id: `FARM-${Date.now()}`,
      farmerId,
      name: (name && String(name).trim()) || `Farm ${mine.length + 1}`,
      location: String(location).trim(),
      coords: finalCoords,
      currentCrop: (currentCrop && String(currentCrop).trim()) || '',
      cropStartDate: currentCrop && String(currentCrop).trim() ? new Date().toISOString() : null,
      cropHistory: [],
      createdAt: new Date().toISOString(),
    };

    farms.push(newFarm);
    await writeFarms(farms);
    res.json({ success: true, farm: newFarm });
  } catch (err) {
    console.error('Add farm failed:', err.message);
    res.status(500).json({ success: false, message: 'Could not add this farm.' });
  }
});

// ── PATCH /api/farms/:id  (rename, move, or change the crop) ───────────────
router.patch('/:id', async (req, res) => {
  try {
    const { farmerId, name, location, coords, currentCrop } = req.body;
    const farms = await readFarms();
    const farm = farms.find(f => f.id === req.params.id);
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    if (farmerId && farm.farmerId !== farmerId) {
      return res.status(403).json({ success: false, message: 'This farm is not yours.' });
    }

    if (typeof name === 'string' && name.trim()) farm.name = name.trim();

    if (typeof location === 'string' && location.trim() && location.trim() !== farm.location) {
      farm.location = location.trim();
      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        farm.coords = { lat: coords.lat, lng: coords.lng };
      } else {
        // Re-geocode against where this farm used to be, so a small correction
        // to the address does not jump the farm across the state.
        farm.coords = await geocodeAddress(farm.location, farm.coords);
      }
    } else if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      farm.coords = { lat: coords.lat, lng: coords.lng };
    }

    // Changing the crop closes the previous one into history, which is what the
    // soil trend analysis later reads to say "N dropped after growing X".
    if (typeof currentCrop === 'string' && currentCrop.trim() !== farm.currentCrop) {
      if (farm.currentCrop) {
        farm.cropHistory = farm.cropHistory || [];
        farm.cropHistory.push({
          crop: farm.currentCrop,
          startedAt: farm.cropStartDate,
          endedAt: new Date().toISOString(),
        });
      }
      farm.currentCrop = currentCrop.trim();
      farm.cropStartDate = currentCrop.trim() ? new Date().toISOString() : null;
    }

    await writeFarms(farms);
    res.json({ success: true, farm });
  } catch (err) {
    console.error('Update farm failed:', err.message);
    res.status(500).json({ success: false, message: 'Could not update this farm.' });
  }
});

// ── DELETE /api/farms/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { farmerId } = req.query;
  const farms = await readFarms();
  const farm = farms.find(f => f.id === req.params.id);
  if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
  if (farmerId && farm.farmerId !== farmerId) {
    return res.status(403).json({ success: false, message: 'This farm is not yours.' });
  }

  await writeFarms(farms.filter(f => f.id !== req.params.id));
  res.json({ success: true });
});

export default router;
