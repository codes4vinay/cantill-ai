/**
 * Corvo Procurement Decision Engine API Server
 * Built with Express, MongoDB/Mongoose, and Policy-as-Data Engine
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const connectDB = require('./config/db');
const { seedAllData, store } = require('./services/seedService');

const { router: batchRouter } = require('./routes/batchRoutes');
const chatRouter = require('./routes/chatRoutes');
const buyerRouter = require('./routes/buyerRoutes');
const policyRouter = require('./routes/policyRoutes');
const supplierRouter = require('./routes/supplierRoutes');
const contractRouter = require('./routes/contractRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '50mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    active_policy_version: store.activePolicy?.version || 'v5.0',
    stats: {
      items_cached: store.items?.length || 0,
      suppliers_cached: store.suppliers?.length || 0,
      contracts_cached: store.contracts?.length || 0,
      po_records_cached: store.poHistory?.length || 0,
      pending_requirements: store.requirements?.length || 0
    }
  });
});

// API Routes
app.use('/api', batchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/policy', policyRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/contracts', contractRouter);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('[API Error]:', err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Self-Ping Keep-Alive for Render Free Tier (Pings every 14 minutes to prevent sleep)
function startKeepAlive() {
  const targetBase = process.env.SELF_PING_URL || process.env.RENDER_EXTERNAL_URL || 'https://cantill-ai-pk3w.onrender.com';
  const pingUrl = `${targetBase.replace(/\/+$/, '')}/api/health`;
  const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

  console.log(`[Keep-Alive] Initialized self-ping service targeting ${pingUrl} every 14 minutes.`);

  setInterval(() => {
    https.get(pingUrl, (res) => {
      console.log(`[Keep-Alive] Ping to ${pingUrl} - Status: ${res.statusCode} at ${new Date().toISOString()}`);
    }).on('error', (err) => {
      console.warn(`[Keep-Alive] Ping warning at ${new Date().toISOString()}: ${err.message}`);
    });
  }, INTERVAL_MS);
}

// Start Server and Seed Data
let serverInstance = null;

async function startServer() {
  await connectDB();
  await seedAllData();

  serverInstance = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Corvo Procurement Decision Engine Running on :${PORT}`);
    console.log(` Active Policy: ${store.activePolicy?.version || 'v5.0'}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);

    startKeepAlive();
  });

  return serverInstance;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };

