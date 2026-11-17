/**
 * Buyer Workspace Route
 * Requirements review, approvals, mandatory override auditing, and CSV export
 */

const express = require('express');
const router = express.Router();
const { store } = require('../services/seedService');
const { generateCSVOutput } = require('./batchRoutes');
const Requirement = require('../models/Requirement');
const AuditLog = require('../models/AuditLog');

// GET /api/buyer/requirements
router.get('/requirements', async (req, res) => {
  try {
    const { route, plant, status, search } = req.query;
    let list = store.requirements || [];

    if (route) list = list.filter(r => r.system_route === route);
    if (plant) list = list.filter(r => r.plant === plant);
    if (status) list = list.filter(r => r.status === status);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.req_id || '').toLowerCase().includes(q) ||
        (r.item_code || '').toLowerCase().includes(q) ||
        (r.item_name || '').toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      total: list.length,
      requirements: list
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/approve/:id
router.post('/approve/:id', async (req, res) => {
  try {
    const reqId = req.params.id;
    const item = (store.requirements || []).find(r => r.req_id === reqId);

    if (!item) {
      return res.status(404).json({ error: `Requirement ${reqId} not found.` });
    }

    item.status = 'Approved';
    if (!item.po_number && ['CONTRACT_PO', 'SPOT_PO', 'EMERGENCY_PO'].includes(item.system_route)) {
      const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      item.po_number = `PO-${d}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    try {
      await Requirement.updateOne(
        { req_id: reqId },
        { $set: { status: 'Approved', po_number: item.po_number } }
      );
      await AuditLog.create({
        action: 'REQUIREMENT_APPROVED',
        actor: req.body.buyer_name || 'Buyer',
        entity_id: reqId,
        details: { route: item.system_route, po_number: item.po_number }
      });
    } catch (e) {}

    res.json({ success: true, message: `Requirement ${reqId} approved.`, requirement: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/override/:id
router.post('/override/:id', async (req, res) => {
  try {
    const reqId = req.params.id;
    const { new_route, new_supplier_id, comment, buyer_name = 'Buyer' } = req.body;

    // MANDATORY COMMENT VALIDATION
    if (!comment || !comment.trim()) {
      return res.status(400).json({
        error: 'Policy Rule: Overriding a system procurement decision requires a mandatory written comment/justification.'
      });
    }

    const item = (store.requirements || []).find(r => r.req_id === reqId);
    if (!item) {
      return res.status(404).json({ error: `Requirement ${reqId} not found.` });
    }

    const previousRoute = item.system_route;
    const previousSupplier = item.system_supplier_id;

    item.status = 'Overridden';
    item.override = {
      is_overridden: true,
      original_route: previousRoute,
      chosen_route: new_route || previousRoute,
      chosen_supplier_id: new_supplier_id || previousSupplier,
      comment: comment.trim(),
      overridden_by: buyer_name,
      overridden_at: new Date()
    };

    if (new_route) item.system_route = new_route;
    if (new_supplier_id) item.system_supplier_id = new_supplier_id;

    try {
      await Requirement.updateOne(
        { req_id: reqId },
        {
          $set: {
            status: 'Overridden',
            system_route: item.system_route,
            system_supplier_id: item.system_supplier_id,
            override: item.override
          }
        }
      );
      await AuditLog.create({
        action: 'REQUIREMENT_OVERRIDDEN',
        actor: buyer_name,
        entity_id: reqId,
        details: {
          original_route: previousRoute,
          new_route: item.system_route,
          comment: comment.trim()
        }
      });
    } catch (e) {}

    res.json({ success: true, message: `Requirement ${reqId} overridden successfully.`, requirement: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buyer/export-csv
router.get('/export-csv', (req, res) => {
  try {
    const list = store.requirements || [];
    const csvContent = generateCSVOutput(list);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cantill_procurement_requirements_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

