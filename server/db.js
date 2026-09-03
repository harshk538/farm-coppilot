import mongoose from 'mongoose';

// One shared connection for the whole app. Mongoose queues up model calls
// made before the connection finishes (bufferCommands, on by default), so
// routes don't need to wait on this themselves — but index.js still awaits
// connectDB() before the server starts listening, so a bad URI fails loudly
// at boot instead of silently on the first request.
let connected = false;

export async function connectDB() {
  if (connected) return mongoose.connection;

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set in server/.env — cannot connect to MongoDB.');
  }

  await mongoose.connect(uri);
  connected = true;
  console.log(`🍃 MongoDB connected → ${mongoose.connection.name}`);

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  return mongoose.connection;
}

export default mongoose;
