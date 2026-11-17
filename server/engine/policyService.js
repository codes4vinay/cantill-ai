/**
 * Policy-As-Data Management Service
 * Manages policy versions, diff computation, amendment parsing, and activation
 */

const DEFAULT_POLICY_V5 = {
  version: 'v5.0',
  title: 'Corvo Procurement Policy v5.0',
  effective_date: new Date('2026-11-01T00:00:00.000Z'),
  active: true,
  clauses: {
    clubbing_window_days_creation: 14,
    clubbing_window_days_need_by: 7,
    spot_threshold_inr: 200000,
    rfq_min_threshold_inr: 200000,
    rfq_max_threshold_inr: 1000000,
    rfq_min_quotes: 3,
    rfp_min_threshold_inr: 1000000,
    rfp_min_quotes: 4,
    emergency_threshold_inr: 500000,
    capex_requires_sourcing: true,
    po_consolidation_window_hours: 24
  },
  amendment_text: 'Baseline policy approved by Management.',
  change_summary: 'Initial baseline policy v5.0'
};

const CLAUSE_LABELS = {
  clubbing_window_days_creation: 'PR Creation Clubbing Window (Days)',
  clubbing_window_days_need_by: 'Need-By Date Cluster Window (Days)',
  spot_threshold_inr: 'Spot Purchase Threshold (INR)',
  rfq_min_threshold_inr: 'RFQ Minimum Threshold (INR)',
  rfq_max_threshold_inr: 'RFQ Maximum Threshold (INR)',
  rfq_min_quotes: 'Minimum Quotes Required for RFQ',
  rfp_min_threshold_inr: 'RFP Minimum Threshold (INR)',
  rfp_min_quotes: 'Minimum Quotes Required for RFP',
  emergency_threshold_inr: 'Emergency Purchase Limit (INR)',
  capex_requires_sourcing: 'Capital Expenditure Sourcing Mandatory',
  po_consolidation_window_hours: 'PO Consolidation Window (Hours)'
};

/**
 * Generate a side-by-side human-readable diff between two policy clause sets
 */
function generatePolicyDiff(currentClauses = {}, proposedClauses = {}) {
  const diffs = [];
  const allKeys = new Set([...Object.keys(currentClauses), ...Object.keys(proposedClauses)]);

  for (const key of allKeys) {
    const oldVal = currentClauses[key];
    const newVal = proposedClauses[key];

    if (newVal !== undefined && oldVal !== newVal) {
      const label = CLAUSE_LABELS[key] || key;
      let impactNote = '';

      if (typeof oldVal === 'number' && typeof newVal === 'number') {
        const delta = newVal - oldVal;
        const sign = delta > 0 ? '+' : '';
        impactNote = ` (${sign}${delta.toLocaleString('en-IN')})`;
      }

      diffs.push({
        key,
        label,
        current_value: oldVal,
        proposed_value: newVal,
        summary: `${label}: ${typeof oldVal === 'number' && oldVal > 100 ? 'INR ' + oldVal.toLocaleString('en-IN') : oldVal} -> ${typeof newVal === 'number' && newVal > 100 ? 'INR ' + newVal.toLocaleString('en-IN') : newVal}${impactNote}`
      });
    }
  }

  return diffs;
}

/**
 * Extract policy updates from natural language or amendment text
 */
function parseAmendmentText(text) {
  if (!text) return {};
  const lower = text.toLowerCase();
  const updates = {};

  // Spot threshold regex
  const spotMatch = lower.match(/spot[^\d]*?(?:inr|rs\.?)?\s*([0-9,]+)/i);
  if (spotMatch) {
    const val = Number(spotMatch[1].replace(/,/g, ''));
    if (val > 0) {
      updates.spot_threshold_inr = val;
      updates.rfq_min_threshold_inr = val;
    }
  }

  // RFQ max / RFP min threshold
  const rfqMaxMatch = lower.match(/(?:rfq|quote|quotation)[^\d]*?(?:max|upper|limit|threshold|ceiling)[^\d]*?(?:inr|rs\.?)?\s*([0-9,]+)/i);
  if (rfqMaxMatch) {
    const val = Number(rfqMaxMatch[1].replace(/,/g, ''));
    if (val > 0) {
      updates.rfq_max_threshold_inr = val;
      updates.rfp_min_threshold_inr = val;
    }
  }

  // Emergency limit
  const emMatch = lower.match(/emergency[^\d]*?(?:inr|rs\.?)?\s*([0-9,]+)/i);
  if (emMatch) {
    const val = Number(emMatch[1].replace(/,/g, ''));
    if (val > 0) updates.emergency_threshold_inr = val;
  }

  // Creation clubbing window
  const clubCreateMatch = lower.match(/(?:creation|pr)[^\d]*?([0-9]+)\s*days/i);
  if (clubCreateMatch) {
    updates.clubbing_window_days_creation = parseInt(clubCreateMatch[1], 10);
  }

  // Need by clubbing window
  const clubNeedMatch = lower.match(/(?:need[\s-]?by)[^\d]*?([0-9]+)\s*days/i);
  if (clubNeedMatch) {
    updates.clubbing_window_days_need_by = parseInt(clubNeedMatch[1], 10);
  }

  // Consolidation window
  const consolMatch = lower.match(/(?:consolidation|combine)[^\d]*?([0-9]+)\s*(?:hours|hrs)/i);
  if (consolMatch) {
    updates.po_consolidation_window_hours = parseInt(consolMatch[1], 10);
  }

  return updates;
}

module.exports = {
  DEFAULT_POLICY_V5,
  CLAUSE_LABELS,
  generatePolicyDiff,
  parseAmendmentText
};
