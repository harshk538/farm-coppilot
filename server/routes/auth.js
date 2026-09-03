import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { geocodeAddress, reverseGeocode } from '../utils/geo.js';
import { readCollection, writeCollection } from '../utils/mongoStore.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'farmcopilot_secret';

// ── Helpers — now backed by MongoDB (the "users" collection) instead of
//    data/users.json. Same read-all / write-all shape the routes below
//    already expect, so nothing past this point had to change. ────────────
const readUsers = () => readCollection('users', []);
const writeUsers = (users) => writeCollection('users', users);

// ── GET /api/auth/geocode  (Signup form's mini-map preview, typed address) ──
router.get('/geocode', async (req, res) => {
  try {
    const address = (req.query.address || '').trim();
    if (!address) {
      return res.status(400).json({ success: false, message: 'Missing address.' });
    }
    const coords = await geocodeAddress(address);
    if (!coords) {
      return res.status(404).json({ success: false, message: 'Could not locate that address.' });
    }
    res.json({ success: true, coords });
  } catch (err) {
    console.error('Geocode route error:', err);
    res.status(500).json({ success: false, message: 'Server error resolving location.' });
  }
});

// ── GET /api/auth/reverse-geocode  (Signup form's "Use Current Location") ──
router.get('/reverse-geocode', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Missing or invalid coordinates.' });
    }
    const address = await reverseGeocode(lat, lng);
    if (!address) {
      return res.status(404).json({ success: false, message: 'Could not resolve an address for this location.' });
    }
    res.json({ success: true, address, coords: { lat, lng } });
  } catch (err) {
    console.error('Reverse geocode route error:', err);
    res.status(500).json({ success: false, message: 'Server error resolving location.' });
  }
});

// ── POST /api/auth/signup ──────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password, fieldLocation } = req.body;

    if (!name || !email || !phone || !password || !fieldLocation) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const users = await readUsers();
    const existing = users.find(u => u.email === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Resolved once at signup, and reused everywhere the app needs "the farmer's
    // location" (equipment job-pings, machine-owner radius check) instead of
    // asking the farmer to type it again every time.
    // If the farmer used the "Use Current Location" button, the browser's real
    // GPS coords are sent directly — use those as-is instead of re-geocoding
    // the address text (which could drift to a slightly different point).
    const { fieldLocationCoords: gpsCoords } = req.body;
    const fieldLocationCoords = (gpsCoords && typeof gpsCoords.lat === 'number' && typeof gpsCoords.lng === 'number')
      ? gpsCoords
      : await geocodeAddress(fieldLocation.trim());

    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      fieldLocation: fieldLocation.trim(),
      fieldLocationCoords,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await writeUsers(users);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone, fieldLocation: newUser.fieldLocation, fieldLocationCoords: newUser.fieldLocationCoords },
    });
  } catch (err) {
    console.error('Signup error trace:', err);
    res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const users = await readUsers();
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, fieldLocation: user.fieldLocation, fieldLocationCoords: user.fieldLocationCoords },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ── GET /api/auth/me  (verify token) ──────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = await readUsers();
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ success: false });
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, fieldLocation: user.fieldLocation, fieldLocationCoords: user.fieldLocationCoords } });
  } catch {
    res.status(401).json({ success: false });
  }
});

export default router;
