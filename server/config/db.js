const mongoose = require('mongoose');
const dns = require('dns');

// Ensure SRV records resolve cleanly on any network
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/corvo_procurement';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    return true;
  } catch (err) {
    console.warn(`[MongoDB] Warning: Could not connect to MongoDB at ${uri}. Running with in-memory store fallback. Error: ${err.message}`);
    return false;
  }
};

module.exports = connectDB;

