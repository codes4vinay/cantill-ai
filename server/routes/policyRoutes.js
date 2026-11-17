/**
 * Policy Management & Versioning Route
 * Implements Policy-as-Data upload, diff preview, and activation without code changes
 */

const express = require('express');
const router = express.Router();
const { store } = require('../services/seedService');
const { generatePolicyDiff, parseAmendmentText } = require('../engine/policyService');
const Policy = require('../models/Policy');
const AuditLog = require('../models/AuditLog');

// GET /api/policy
router.get('/', async (req, res) => {
  try {
    let active = store.activePolicy;
    let allPolicies = [active];

    try {
      const dbPolicies = await Policy.find().sort({ createdAt: -1 });
      if (dbPolicies.length > 0) {
        allPolicies = dbPolicies;
        active = dbPolicies.find(p => p.active) || dbPolicies[0];
      }
    } catch (e) {}

    res.json({
      success: true,
      active_policy: active,
      history: allPolicies
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/policy/preview-diff
router.post('/preview-diff', (req, res) => {
  try {
    const { amendment_text, proposed_clauses } = req.body;
    let clausesToApply = proposed_clauses || {};

    if (amendment_text && Object.keys(clausesToApply).length === 0) {
      clausesToApply = parseAmendmentText(amendment_text);
    }

    const currentClauses = store.activePolicy?.clauses || {};
    const mergedProposed = { ...currentClauses, ...clausesToApply };
    const diffs = generatePolicyDiff(currentClauses, mergedProposed);

    res.json({
      success: true,
      parsed_updates: clausesToApply,
      diffs,
      proposed_clauses: mergedProposed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/policy/activate
router.post('/activate', async (req, res) => {
  try {
    const {
      version,
      title,
      effective_date,
      clauses,
      amendment_text,
      change_summary
    } = req.body;

    if (!version || !clauses) {
      return res.status(400).json({ error: 'Version and clauses are required.' });
    }

    const newPolicyObj = {
      version,
      title: title || `Corvo Procurement Policy ${version}`,
      effective_date: effective_date ? new Date(effective_date) : new Date(),
      active: true,
      clauses,
      amendment_text: amendment_text || '',
      change_summary: change_summary || 'Policy amendment activated'
    };

    // Update in-memory store
    store.activePolicy = newPolicyObj;

    // Update MongoDB
    try {
      await Policy.updateMany({}, { $set: { active: false } });
      const created = await Policy.create(newPolicyObj);
      await AuditLog.create({
        action: 'POLICY_ACTIVATED',
        actor: 'ProcurementAdmin',
        entity_id: version,
        details: { version, clauses, change_summary }
      });
      newPolicyObj._id = created._id;
    } catch (e) {}

    res.json({
      success: true,
      message: `Policy ${version} is now ACTIVE! All future PR decisions will follow this policy without code changes.`,
      active_policy: newPolicyObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

