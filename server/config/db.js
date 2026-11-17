const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/corvo_procurement';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    return true;
  } catch (err) {
    console.warn(`[MongoDB] Warning: Could not connect to MongoDB at ${uri}. Running with in-memory store fallback. Error: ${err.message}`);
    return false;
  }
};

module.exports = connectDB;
