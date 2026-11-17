/**
 * PO Consolidation Service
 * Implements Policy Section 6: 24-hour window PO consolidation
 */

function parseDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  return new Date(d);
}

/**
 * Consolidate approved requirements into Purchase Orders
 * @param {Array} evaluatedRequirements
 * @param {number} windowHours - default 24
 */
function consolidatePOs(evaluatedRequirements, windowHours = 24) {
  const windowMs = windowHours * 60 * 60 * 1000;
  let poSequence = 1001;

  // Filter for direct PO routes that have an assigned supplier
  const poRoutes = new Set(['CONTRACT_PO', 'SPOT_PO', 'EMERGENCY_PO']);

  const groups = {}; // key: `${supplier_id}__${plant}__${route}`

  for (const req of evaluatedRequirements) {
    if (!poRoutes.has(req.system_route) || !req.system_supplier_id) {
      continue;
    }
    const key = `${req.system_supplier_id}__${req.plant}__${req.system_route}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(req);
  }

  for (const [key, reqList] of Object.entries(groups)) {
    // Sort by earliest_creation_date ascending
    reqList.sort((a, b) => parseDate(a.earliest_creation_date) - parseDate(b.earliest_creation_date));

    let currentWindowStart = null;
    let currentPONumber = null;

    for (const req of reqList) {
      const cDate = parseDate(req.earliest_creation_date);

      if (!currentWindowStart || (cDate.getTime() - currentWindowStart.getTime()) > windowMs) {
        currentWindowStart = cDate;
        const dateStr = cDate.toISOString().slice(0, 10).replace(/-/g, '');
        currentPONumber = `PO-${dateStr}-${poSequence++}`;
      }

      req.po_number = currentPONumber;
    }
  }

  return evaluatedRequirements;
}

module.exports = {
  consolidatePOs
};

