/**
 * Batch PR Processing Route
 * Implements Task Brief Section 4: POST /api/process-batch and CSV Export
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { store } = require('../services/seedService');
const { matchItem } = require('../engine/itemMatcher');
const { clubPRLines } = require('../engine/clubbingService');
const { evaluateRequirement } = require('../engine/decisionRules');
const { consolidatePOs } = require('../engine/consolidationService');
const Requirement = require('../models/Requirement');
const AuditLog = require('../models/AuditLog');

function parseCSVBuffer(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(',');
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = rawCols[idx] !== undefined ? rawCols[idx].trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

function generateCSVOutput(evaluatedRequirements) {
  const headers = [
    'req_id',
    'pr_ids',
    'item_code',
    'plant',
    'total_quantity',
    'need_by_date',
    'estimated_unit_price',
    'valuation_method',
    'total_value',
    'route',
    'rule_clause',
    'supplier_id',
    'suggested_suppliers',
    'po_number'
  ];

  const rows = evaluatedRequirements.map(req => {
    const prIds = (req.lines || []).map(l => l.pr_id).filter(Boolean).join(';');
    const needBy = req.need_by_date ? new Date(req.need_by_date).toISOString().slice(0, 10) : '';
    const suggested = (req.suggested_suppliers || []).map(s => s.supplier_id || s.name).join(';');
    const clauseCleaned = `"${(req.system_clause || '').replace(/"/g, '""')}"`;
    const po = req.po_number || '';

    return [
      req.req_id,
      prIds,
      req.item_code,
      req.plant,
      req.total_quantity,
      needBy,
      req.estimated_unit_price,
      req.valuation_method,
      req.total_value_inr,
      req.system_route,
      clauseCleaned,
      req.system_supplier_id || '',
      suggested,
      po
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Core processing logic shared between upload and direct JSON body
 */
async function processBatch(rawPRLines, batchId = `BATCH-${Date.now()}`) {
  const items = store.items || [];
  const suppliers = store.suppliers || [];
  const contracts = store.contracts || [];
  const poHistory = store.poHistory || [];
  const activePolicy = store.activePolicy || {};

  // 1. NLP Item Matching
  const enrichedPRLines = rawPRLines.map(line => {
    const rawCode = (line.item_code || line.item || '').trim();
    const rawDesc = (line.description || line.raw_description || line.item_name || '').trim();
    const matched = matchItem(
      { item_code: rawCode, description: rawDesc },
      items
    );

    return {
      pr_id: line.pr_no || line.pr_id || `PR-${Math.floor(Math.random() * 90000 + 10000)}`,
      line_number: Number(line.pr_line || line.line_number) || 1,
      item_code: matched.item_code,
      item_name: matched.item_name,
      category: matched.category,
      is_new: matched.is_new,
      match_confidence: matched.confidence,
      plant: line.plant || 'CHK1',
      quantity: Number(line.quantity) || 1,
      need_by_date: line.need_by_date || new Date(),
      creation_date: line.created_at || line.creation_date || new Date(),
      urgency: line.urgency || 'Standard',
      is_capex: line.is_capex === 'true' || line.is_capex === true || line.is_capex === '1',
      raw_description: rawDesc,
      estimated_unit_price: Number(line.estimated_unit_price || line.unit_price) || 0,
      requester: line.requester || 'Employee'
    };
  });

  // 2. Club into Requirements
  const clubbed = clubPRLines(enrichedPRLines, activePolicy.clauses);

  // 3. Evaluate each Requirement against Policy Rules
  const consumedCeilings = new Map();
  const evaluated = [];

  for (const req of clubbed) {
    const decision = evaluateRequirement(
      req,
      activePolicy,
      contracts,
      poHistory,
      suppliers,
      items,
      consumedCeilings
    );

    const enrichedReq = {
      ...req,
      batch_id: batchId,
      estimated_unit_price: decision.unit_price,
      valuation_method: decision.valuation_method,
      total_value_inr: decision.total_value,
      system_route: decision.route,
      system_clause: decision.clause,
      system_supplier_id: decision.assigned_supplier?.supplier_id || null,
      system_supplier_name: decision.assigned_supplier?.name || null,
      suggested_suppliers: decision.suggested_suppliers || [],
      contract_id: decision.contract_id || null,
      status: 'Pending Review'
    };

    evaluated.push(enrichedReq);
  }

  // 4. Consolidate POs
  consolidatePOs(evaluated, activePolicy.clauses?.po_consolidation_window_hours ?? 24);

  // Store in memory & MongoDB
  store.requirements = [...evaluated, ...store.requirements];

  try {
    await Requirement.deleteMany({ batch_id: batchId });
    await Requirement.insertMany(evaluated);
    await AuditLog.create({
      action: 'BATCH_PROCESSED',
      actor: 'BatchEngine',
      details: { batch_id: batchId, total_prs: rawPRLines.length, total_requirements: evaluated.length }
    });
  } catch (err) {
    // In-memory fallback
  }

  return evaluated;
}

// POST /api/process-batch
router.post('/process-batch', upload.single('file'), async (req, res) => {
  try {
    let prLines = [];

    if (req.file) {
      prLines = parseCSVBuffer(req.file.buffer);
    } else if (req.body.pr_lines && Array.isArray(req.body.pr_lines)) {
      prLines = req.body.pr_lines;
    } else if (typeof req.body === 'string') {
      prLines = parseCSVBuffer(Buffer.from(req.body));
    } else {
      return res.status(400).json({ error: 'Please upload a CSV file or provide pr_lines array.' });
    }

    if (prLines.length === 0) {
      return res.status(400).json({ error: 'No PR lines found in input.' });
    }

    const batchId = `BATCH-${Date.now()}`;
    const evaluated = await processBatch(prLines, batchId);

    if (req.query.format === 'csv') {
      const csvData = generateCSVOutput(evaluated);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="run_output_${Date.now()}.csv"`);
      return res.status(200).send(csvData);
    }

    res.status(200).json({
      success: true,
      batch_id: batchId,
      total_prs: prLines.length,
      total_requirements: evaluated.length,
      requirements: evaluated
    });
  } catch (err) {
    console.error('Batch processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  processBatch,
  generateCSVOutput
};
