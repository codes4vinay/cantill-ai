/**
 * Supplier Management & Preferred Supplier List Route
 * Computes multi-attribute weighted rankings as of given dates and exports CSV
 */

const express = require('express');
const router = express.Router();
const { store } = require('../services/seedService');
const { rankSuppliersForItem } = require('../engine/rankingService');

// GET /api/suppliers
router.get('/', (req, res) => {
  res.json({ success: true, suppliers: store.suppliers || [] });
});

// GET /api/suppliers/preferred
router.get('/preferred', (req, res) => {
  try {
    const asOfDate = req.query.as_of_date ? new Date(req.query.as_of_date) : new Date('2026-11-15T00:00:00.000Z');
    const items = store.items || [];
    const suppliers = store.suppliers || [];
    const poHistory = store.poHistory || [];
    const contracts = store.contracts || [];

    const preferredMap = [];

    for (const it of items) {
      const ranked = rankSuppliersForItem(it.item_code, asOfDate, suppliers, poHistory, contracts);
      // Top 3
      const top3 = ranked.slice(0, 3).map((s, idx) => ({
        item_code: it.item_code,
        item_name: it.item_name,
        category: it.category,
        rank: idx + 1,
        supplier_id: s.supplier_id,
        supplier_name: s.name,
        score: s.score,
        reference_price: s.reference_price,
        po_count: s.po_count,
        has_contract: s.has_contract,
        on_time_pct: s.on_time_pct,
        quality_rating: s.quality_rating
      }));

      preferredMap.push({
        item_code: it.item_code,
        item_name: it.item_name,
        category: it.category,
        top_suppliers: top3
      });
    }

    res.json({
      success: true,
      as_of_date: asOfDate.toISOString().slice(0, 10),
      total_items: items.length,
      items: preferredMap
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/suppliers/preferred/export-csv
router.get('/preferred/export-csv', (req, res) => {
  try {
    const asOfDate = req.query.as_of_date ? new Date(req.query.as_of_date) : new Date('2026-11-15T00:00:00.000Z');
    const items = store.items || [];
    const suppliers = store.suppliers || [];
    const poHistory = store.poHistory || [];
    const contracts = store.contracts || [];

    const headers = ['item_code', 'rank', 'supplier_id', 'supplier_name', 'score', 'reference_price'];
    const rows = [];

    for (const it of items) {
      const ranked = rankSuppliersForItem(it.item_code, asOfDate, suppliers, poHistory, contracts);
      ranked.slice(0, 3).forEach((s, idx) => {
        rows.push([
          it.item_code,
          idx + 1,
          s.supplier_id,
          `"${(s.name || '').replace(/"/g, '""')}"`,
          s.score,
          s.reference_price
        ].join(','));
      });
    }

    const csvData = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="preferred_suppliers_${asOfDate.toISOString().slice(0, 10)}.csv"`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

