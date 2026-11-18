/**
 * Data Seeding & Caching Service
 * Loads CSV master data, contract registers, and baseline policy v5.0
 * Provides both MongoDB persistence and high-speed in-memory caching.
 */

const fs = require('fs');
const path = require('path');
const Item = require('../models/Item');
const Supplier = require('../models/Supplier');
const POHistory = require('../models/POHistory');
const Contract = require('../models/Contract');
const Policy = require('../models/Policy');
const { DEFAULT_POLICY_V5 } = require('../engine/policyService');

// In-Memory Fast Cache
const store = {
  items: [],
  suppliers: [],
  contracts: [],
  poHistory: [],
  activePolicy: null,
  requirements: []
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function readCSVFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[SeedService] File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(obj);
  }
  return rows;
}

async function seedAllData() {
  console.log('[SeedService] Initializing procurement data and caches...');

  // Locate data directory
  const rootDataDir = path.resolve(__dirname, '../../data');
  const masterDir = path.join(rootDataDir, 'master_data');
  const contractsDir = path.join(rootDataDir, 'contracts');

  // 1. Items
  const itemRows = readCSVFile(path.join(masterDir, 'item_master.csv'));
  store.items = itemRows.map(r => ({
    item_code: r.item_code,
    item_name: r.item_name || r.description || '',
    category: r.category,
    uom: r.uom || 'EA',
    catalog_price: Number(r.catalog_price || r.standard_price || 0)
  }));

  // 2. Suppliers
  const supplierRows = readCSVFile(path.join(masterDir, 'supplier_master.csv'));
  store.suppliers = supplierRows.map(r => ({
    supplier_id: r.supplier_id,
    name: r.name,
    categories: (r.categories || r.category || '').split(/[;,]/).map(c => c.trim()).filter(Boolean),
    quality_rating: Number(r.quality_rating || 0),
    on_time_delivery_pct: Number(r.on_time_delivery_pct || 0),
    payment_terms: r.payment_terms || 'Net 30',
    active: r.active !== 'false' && r.active !== '0'
  }));

  // 3. PO History
  const poRows = readCSVFile(path.join(masterDir, 'po_history.csv'));
  store.poHistory = poRows.map(r => ({
    po_number: r.po_number,
    po_date: new Date(r.po_date),
    supplier_id: r.supplier_id,
    item_code: r.item_code,
    plant: r.plant,
    quantity: Number(r.quantity || 0),
    unit_price: Number(r.unit_price || 0),
    currency: r.currency || 'INR',
    on_time_delivery: r.on_time_delivery === 'true' || r.on_time_delivery === '1' || r.on_time_delivery === 'Y',
    quality_accepted: r.quality_accepted === 'true' || r.quality_accepted === '1' || r.quality_accepted === 'Y'
  }));

  // 4. Contracts (Register + Lines + Unlisted PDFs)
  const regRows = readCSVFile(path.join(contractsDir, 'contract_register.csv'));
  const lineRows = readCSVFile(path.join(contractsDir, 'contract_lines.csv'));

  const contractsMap = {};
  for (const reg of regRows) {
    const effDate = new Date(reg.start_date || reg.effective_date || Date.now());
    const expDate = new Date(reg.end_date || reg.expiry_date || Date.now() + 365*24*60*60*1000);
    contractsMap[reg.contract_id] = {
      contract_id: reg.contract_id,
      supplier_id: reg.supplier_id,
      effective_date: isNaN(effDate.getTime()) ? new Date() : effDate,
      expiry_date: isNaN(expDate.getTime()) ? new Date() : expDate,
      overall_ceiling: Number(reg.value_cap || reg.overall_ceiling || 0),
      consumed_value: Number(reg.consumed_value || 0),
      lines: [],
      status: 'Active'
    };
  }

  for (const line of lineRows) {
    if (contractsMap[line.contract_id]) {
      contractsMap[line.contract_id].lines.push({
        item_code: line.item_code,
        contract_price: Number(line.rate || line.contract_price || 0),
        min_order_qty: Number(line.min_order_qty || 1),
        ceiling: Number(line.line_ceiling || line.ceiling || contractsMap[line.contract_id].overall_ceiling)
      });
    }
  }

  // Add parsed unlisted PDF contracts (RC-2026-031 & RC-2026-033)
  if (!contractsMap['RC-2026-031']) {
    contractsMap['RC-2026-031'] = {
      contract_id: 'RC-2026-031',
      supplier_id: 'S021',
      effective_date: new Date('2026-11-15T00:00:00.000Z'),
      expiry_date: new Date('2027-11-14T00:00:00.000Z'),
      overall_ceiling: 2000000,
      consumed_value: 0,
      lines: [
        { item_code: 'ITM-1025', contract_price: 1250, min_order_qty: 1, ceiling: 2000000 },
        { item_code: 'ITM-1026', contract_price: 1950, min_order_qty: 1, ceiling: 2000000 },
        { item_code: 'ITM-1033', contract_price: 450, min_order_qty: 1, ceiling: 2000000 }
      ],
      status: 'Active',
      source_file: 'RC-2026-031.pdf'
    };
  }

  if (!contractsMap['RC-2026-033']) {
    contractsMap['RC-2026-033'] = {
      contract_id: 'RC-2026-033',
      supplier_id: 'S035',
      effective_date: new Date('2026-11-20T00:00:00.000Z'),
      expiry_date: new Date('2027-11-19T00:00:00.000Z'),
      overall_ceiling: 5000000,
      consumed_value: 0,
      lines: [
        { item_code: 'ITM-1030', contract_price: 380, min_order_qty: 1, ceiling: 5000000 },
        { item_code: 'ITM-1031', contract_price: 28000, min_order_qty: 1, ceiling: 5000000 },
        { item_code: 'ITM-1032', contract_price: 12000, min_order_qty: 1, ceiling: 5000000 }
      ],
      status: 'Active',
      source_file: 'RC-2026-033.pdf'
    };
  }

  store.contracts = Object.values(contractsMap);

  // Fallback to pre-bundled seedData.json if CSV master data files are not present
  if (store.items.length === 0) {
    const fallbackPath = path.resolve(__dirname, './seedData.json');
    if (fs.existsSync(fallbackPath)) {
      try {
        const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        store.items = fallbackData.items || [];
        store.suppliers = fallbackData.suppliers || [];
        store.poHistory = (fallbackData.poHistory || []).map(p => ({
          ...p,
          po_date: new Date(p.po_date)
        }));
        store.contracts = (fallbackData.contracts || []).map(c => ({
          ...c,
          effective_date: new Date(c.effective_date),
          expiry_date: new Date(c.expiry_date)
        }));
        console.log(`[SeedService] Loaded from fallback seedData.json: ${store.items.length} items, ${store.suppliers.length} suppliers, ${store.poHistory.length} POs, ${store.contracts.length} contracts.`);
      } catch (e) {
        console.error('[SeedService] Failed loading fallback seedData.json:', e.message);
      }
    }
  }

  // 5. Policy v5.0
  store.activePolicy = { ...DEFAULT_POLICY_V5 };

  console.log(`[SeedService] Cached: ${store.items.length} items, ${store.suppliers.length} suppliers, ${store.poHistory.length} POs, ${store.contracts.length} contracts.`);

  // Persist to MongoDB if connected
  try {
    const itemCount = await Item.countDocuments();
    if (itemCount === 0 && store.items.length > 0) {
      await Item.insertMany(store.items);
      console.log(`[SeedService] Inserted ${store.items.length} items to MongoDB`);
    }

    const supplierCount = await Supplier.countDocuments();
    if (supplierCount === 0 && store.suppliers.length > 0) {
      await Supplier.insertMany(store.suppliers);
      console.log(`[SeedService] Inserted ${store.suppliers.length} suppliers to MongoDB`);
    }

    const poCount = await POHistory.countDocuments();
    if (poCount === 0 && store.poHistory.length > 0) {
      await POHistory.insertMany(store.poHistory);
      console.log(`[SeedService] Inserted ${store.poHistory.length} POs to MongoDB`);
    }

    const contractCount = await Contract.countDocuments();
    if (contractCount === 0 && store.contracts.length > 0) {
      await Contract.insertMany(store.contracts);
      console.log(`[SeedService] Inserted ${store.contracts.length} contracts to MongoDB`);
    }

    const policyDoc = await Policy.findOne({ active: true });
    if (!policyDoc) {
      const createdPolicy = await Policy.create(DEFAULT_POLICY_V5);
      store.activePolicy = createdPolicy.toObject();
      console.log(`[SeedService] Created default Policy v5.0 in MongoDB`);
    } else {
      store.activePolicy = policyDoc.toObject();
    }
  } catch (mongoErr) {
    console.warn(`[SeedService] MongoDB syncing skipped (${mongoErr.message}). In-memory store active.`);
  }

  return store;
}

module.exports = {
  seedAllData,
  store,
  readCSVFile
};
