import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import advisoryRoutes from './routes/advisory.js';
import treatmentRoutes from './routes/treatment.js';
import weatherRoutes from './routes/weather.js';
import authRoutes from './routes/auth.js';
import vendorRoutes from './routes/vendor.js';
import equipmentRoutes from './routes/equipment.js';

const app = express();

app.use(cors({
  origin: '*', // For development, allow all. In production, this should be restricted.
}));
app.use(express.json());

app.use('/api/advisory', advisoryRoutes);
app.use('/api/treatment', treatmentRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/equipment', equipmentRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Server working');
});

const PORT = process.env.PORT || 5005;

const server = app.listen(PORT, () => {
  console.log(`🌾 Server running on http://localhost:${PORT}`);
});

// Guard against silent server crashes
server.on('error', (err) => {
  console.error("❌ Server error:", err);
});

process.on('uncaughtException', (err) => {
  console.error("❌ CRASH ERROR:", err.stack);
});

// Forces the event loop to stay active
setInterval(() => {}, 1000 * 60 * 60);