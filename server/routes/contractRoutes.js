/**
 * Contract Register & PDF Contract Ingestion Route
 * Tracks live contract ceiling depletion and ingests rate contract PDFs
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { store } = require('../services/seedService');
const { parseContractPDF } = require('../engine/pdfContractParser');
const Contract = require('../models/Contract');
const AuditLog = require('../models/AuditLog');

// GET /api/contracts
router.get('/', (req, res) => {
  const contracts = (store.contracts || []).map(c => {
    const overallCeiling = Number(c.overall_ceiling) || 0;
    const consumed = Number(c.consumed_value) || 0;
    const remaining = overallCeiling - consumed;
    const utilizationPct = overallCeiling > 0 ? Number(((consumed / overallCeiling) * 100).toFixed(1)) : 0;

    return {
      ...c,
      remaining_ceiling: remaining,
      utilization_pct: utilizationPct
    };
  });

  res.json({ success: true, count: contracts.length, contracts });
});

// POST /api/contracts/upload-pdf
router.post('/upload-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF file.' });
    }

    const parsedContract = await parseContractPDF(req.file.buffer);
    parsedContract.source_file = req.file.originalname;

    // Check if contract already exists
    const existingIdx = (store.contracts || []).findIndex(c => c.contract_id === parsedContract.contract_id);
    if (existingIdx >= 0) {
      store.contracts[existingIdx] = parsedContract;
    } else {
      store.contracts.unshift(parsedContract);
    }

    try {
      await Contract.findOneAndUpdate(
        { contract_id: parsedContract.contract_id },
        parsedContract,
        { upsert: true, new: true }
      );
      await AuditLog.create({
        action: 'CONTRACT_UPLOADED',
        actor: 'ContractManager',
        entity_id: parsedContract.contract_id,
        details: {
          supplier_id: parsedContract.supplier_id,
          overall_ceiling: parsedContract.overall_ceiling,
          lines_count: parsedContract.lines?.length
        }
      });
    } catch (e) {}

    res.json({
      success: true,
      message: `Contract ${parsedContract.contract_id} uploaded and activated successfully.`,
      contract: parsedContract
    });
  } catch (err) {
    console.error('Contract PDF upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
